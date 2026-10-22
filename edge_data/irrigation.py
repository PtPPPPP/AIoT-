"""Evidence-based irrigation reconstruction; commands do not prove watering."""
from .analysis import context_at, describe_series, event_markers
from .common import iso, stamp


def reconstruct(events, max_gap_seconds, presorted=False):
    results, active, previous = [], None, None

    def begin(event, requested=False):
        return {'id': event.get('commandId') if requested else event['id'], 'aliases': [event['id']] + ([event['commandId']] if event.get('commandId') else []),
                'zoneId': event['zoneId'], 'requestedAt': event['observedAt'] if requested else None,
                'startedAt': None, 'stoppedAt': None, 'startBounds': None, 'stopBounds': None,
                'startFeedbackLevel': None, 'stopFeedbackLevel': None, 'supportedRunSeconds': 0,
                'hasGap': False, 'stopRequestedAt': None, 'timeline': [], 'commandFailed': False}

    def append_timeline(event):
        timeline = active['timeline']
        if timeline and event['kind'] == 'feedback' and timeline[-1]['kind'] == 'feedback' and event.get('actual') == timeline[-1].get('actual') and event.get('feedbackLevel') == timeline[-1].get('feedbackLevel'):
            previous_item = timeline[-1]
            timeline[-1] = {**event, 'firstObservedAt': previous_item.get('firstObservedAt', previous_item['observedAt']), 'observationCount': previous_item.get('observationCount', 1) + 1}
        else:
            timeline.append(event)

    ordered = events if presorted else sorted(events, key=lambda e: (stamp(e['observedAt']), 0 if e['kind'] == 'command' else 1, e['id']))
    for event in ordered:
        at = stamp(event['observedAt'])
        if event['kind'] == 'collector-gap':
            if active:
                active['hasGap'] = True; active['timeline'].append(event)
            previous = None
            continue
        if event.get('device') != 'waterPump' or event['kind'] not in ('command', 'feedback'):
            continue
        if event['kind'] == 'command':
            if event['target']:
                if active is None:
                    active = begin(event, True)
                if not active['requestedAt']:
                    active['requestedAt'] = event['observedAt']
                active['aliases'] += [event['id'], event['commandId']]
            if active:
                active['timeline'].append(event)
                if not event['target']:
                    active['stopRequestedAt'] = event['observedAt']
                if event['status'] in ('failed', 'rejected', 'cancelled', 'timed_out'):
                    active['commandFailed'] = True
            continue
        actual = event.get('actual')
        level = event.get('feedbackLevel', 'gateway')
        continuous = previous is not None and 0 <= at - stamp(previous['observedAt']) <= max_gap_seconds * 1000 and previous.get('feedbackLevel', 'gateway') == level
        if actual is True:
            if active is None:
                active = begin(event)
            append_timeline(event)
            if active['startedAt'] is None:
                active['aliases'].append(event['id'])
                active['startedAt'] = event['observedAt']
                active['startFeedbackLevel'] = level
                lower = previous['observedAt'] if continuous and previous.get('actual') is False else None
                if event.get('precisionMs') == 0 and event.get('timeBasis') == 'edge-transition':
                    lower = event['observedAt']
                active['startBounds'] = {'earliest': lower, 'latest': event['observedAt']}
            elif continuous and previous.get('actual') is True:
                active['supportedRunSeconds'] += (at - stamp(previous['observedAt'])) / 1000
            else:
                active['hasGap'] = True
        elif actual is False and active:
            append_timeline(event)
            if active['startedAt'] is not None:
                active['stoppedAt'] = event['observedAt']; active['stopFeedbackLevel'] = level
                lower = previous['observedAt'] if continuous and previous.get('actual') is True else None
                if event.get('precisionMs') == 0 and event.get('timeBasis') == 'edge-transition':
                    lower = event['observedAt']
                active['stopBounds'] = {'earliest': lower, 'latest': event['observedAt']}
                if not continuous:
                    active['hasGap'] = True
                results.append(active); active = None
        elif actual is None and active:
            active['hasGap'] = True; active['timeline'].append(event)
        previous = event if actual is not None else None
    if active:
        results.append(active)
    return results


def effect(store, kind, event, now, default_gap, include_samples=True):
    event = dict(event)
    anchor = stamp(event['requestedAt'] or event['startedAt'])
    contexts = store.contexts(kind, event['zoneId'])
    context = context_at(contexts, anchor)
    settings = context.get('analysis', {}) if context else {}
    event['context'] = context
    event['batchId'] = context.get('batchId') if context else None
    event['aliases'] = list(dict.fromkeys(event['aliases']))
    event['durationBoundsSeconds'] = None
    if event['startBounds'] and event['stopBounds'] and not event['hasGap'] and event['startFeedbackLevel'] == event['stopFeedbackLevel']:
        start, stop = event['startBounds'], event['stopBounds']
        event['durationBoundsSeconds'] = {
            'minimum': max(0, (stamp(stop['earliest']) - stamp(start['latest'])) / 1000) if stop['earliest'] else None,
            'maximum': max(0, (stamp(stop['latest']) - stamp(start['earliest'])) / 1000) if start['earliest'] else None}
    event['physicalStartObserved'] = event['startFeedbackLevel'] == 'physical'
    event['physicalStopObserved'] = event['stopFeedbackLevel'] == 'physical'
    event['evidenceState'] = '已取得停止反馈' if event['stoppedAt'] else '已取得运行反馈，停止未确认' if event['startedAt'] else '已请求，运行未确认'
    event.update({'outcome': '无法判断', 'limitations': [], 'before': None, 'after': None, 'moistureDelta': None,
                  'responseAt': None, 'responseDelaySeconds': None, 'targetReturnAt': None, 'targetReturnVersion': None,
                  'observationUntil': None, 'interventions': [], 'notes': [], 'samples': [], 'relatedEvents': []})
    if not all(settings.get(k) for k in ('preWindowSeconds', 'postWindowSeconds', 'responseDelta')):
        event['limitations'].append('分析窗口或湿度响应判据未配置；不使用演示阈值推断农艺效果')
        pre, post = 600, 1800  # Retrieval-only technical context, never used to judge response without configuration.
    else:
        pre, post = settings['preWindowSeconds'], settings['postWindowSeconds']
    stop_anchor = stamp(event['stoppedAt']) if event['stoppedAt'] else stamp(event['startedAt']) if event['startedAt'] else anchor
    until = stop_anchor + post * 1000
    start, end = anchor - pre * 1000, min(now, until)
    event['windowFrom'], event['windowTo'] = iso(start), iso(max(start, end))
    event['observationUntil'] = iso(until) if not event['limitations'] else None
    if store.sample_count(kind, event['zoneId'], start - 3600000, max(end, anchor) + 3600000) > 200000:
        event['limitations'].append('前后分析窗口超过 200000 条原始记录，请缩小已配置窗口；未用降采样替代分析')
        return event
    raw = store.samples(kind, event['zoneId'], start - 3600000, max(end, anchor) + 3600000, None if include_samples else 'soilMoisture')
    event['samples'] = [s for s in raw if start <= stamp(s['capturedAt']) <= max(end, anchor)] if include_samples else []
    related = store.events(kind, event['zoneId'], start, max(end, anchor), operational_only=not include_samples)
    markers = event_markers(related) if include_samples else []
    event['relatedEvents'] = markers[:2000]
    event['relatedEventsTruncated'] = len(markers) > 2000
    event['notes'] = [e for e in related if e['kind'] == 'manual' and (not e.get('irrigationId') or e['irrigationId'] in [event['id']] + event['aliases'])]
    event['interventions'] = [e for e in related if e['kind'] == 'manual' and e.get('operation') != 'inspection' or e['kind'] == 'command' and e.get('device') != 'waterPump']
    if event['hasGap']:
        event['limitations'].append('反馈中断、跨越服务重启或层级变化；不能假定期间持续运行或已经停机')
    if not event['physicalStartObserved'] or not event['physicalStopObserved']:
        event['limitations'].append('未同时取得物理运行与停止反馈，不能确认真实灌溉完成')
    if event['interventions']:
        event['limitations'].append('观察窗口存在人工浇水、维护／校准或其他设备操作，不能将变化单独归因于灌溉')
    soils = [s for s in raw if s['key'] == 'soilMoisture']
    sensor_ids = {s['sensorId'] for s in soils}
    selected_sensor = context.get('soilSensorId') if context else None
    if selected_sensor:
        soils = [s for s in soils if s['sensorId'] == selected_sensor]
    elif len(sensor_ids) > 1:
        event['limitations'].append('区域有多个土壤传感器，未指定复盘传感器，不能混合计算')
        soils = []
    gap = default_gap  # Each interval still resolves its own historical maxGapSeconds version.
    event['before'] = describe_series(soils, start, anchor, contexts, gap) if soils else None
    event['after'] = describe_series(soils, stop_anchor, max(stop_anchor, end), contexts, gap) if soils else None
    if any(c['version'] != (context or {}).get('version') and start < stamp(c['effectiveAt']) < until for c in contexts):
        event['limitations'].append('分析窗口跨越种植或目标配置变更；目标按当时版本判断')
    if not all(settings.get(k) for k in ('preWindowSeconds', 'postWindowSeconds', 'responseDelta')):
        return event
    if now < until:
        event['outcome'] = '观察中'
    before, after = event['before'], event['after']
    if not before or not after or before['timeWeightedMean'] is None or after['timeWeightedMean'] is None:
        event['limitations'].append('缺少可计算的前后有效湿度序列')
        return event
    event['moistureDelta'] = after['timeWeightedMean'] - before['timeWeightedMean']
    good_after = [s for s in soils if s['quality'] == 'good' and s['value'] is not None and stop_anchor <= stamp(s['capturedAt']) <= end]
    for sample in good_after:
        at = stamp(sample['capturedAt'])
        if event['responseAt'] is None and sample['value'] - before['timeWeightedMean'] >= settings['responseDelta']:
            event['responseAt'] = sample['capturedAt']; event['responseDelaySeconds'] = (at - stop_anchor) / 1000
        sample_context = context_at(contexts, at)
        target = sample_context.get('targets', {}).get('soilMoisture') if sample_context else None
        if event['targetReturnAt'] is None and target and target.get('confirmed') and target['unit'] == '%' and target['low'] <= sample['value'] <= target['high']:
            event['targetReturnAt'] = sample['capturedAt']; event['targetReturnVersion'] = sample_context['version']
    if before['coverage'] < 0.8 or after['coverage'] < 0.8:
        event['limitations'].append('前后有效时间覆盖率低于技术判读门槛 80%，不足以作完整响应判断')
    if now >= until:
        if not event['stoppedAt'] or not event['startedAt'] or before['coverage'] < 0.8 or after['coverage'] < 0.8 or event['interventions']:
            event['outcome'] = '无法判断'
        elif event['responseAt']:
            event['outcome'] = '已观察到配置判据对应的湿度变化（不证明因果）'
        else:
            event['outcome'] = '未观察到配置预期响应，建议人工核查'
    event['responseMethod'] = '以灌溉前窗口的时间加权均值为基线；停止反馈后的首次有效采样达到配置增量记为响应。响应时间与目标恢复均为首次观测时间，精度受采样间隔限制。80% 是保守技术覆盖门槛，不是农艺标准。'
    return event


def irrigations(store, kind, zone, start, end, now, max_gap_seconds, event_id=None):
    # Include retained pre-range evidence: an unclosed irrigation must survive day boundaries and restart.
    reconstructed = reconstruct(store.irrigation_events(kind, zone, max(end, now)), max_gap_seconds, presorted=True)
    selected = [e for e in reconstructed if (event_id in [e['id']] + e['aliases'] if event_id else stamp(e['requestedAt'] or e['startedAt']) <= end and (not e['stoppedAt'] or stamp(e['stoppedAt']) >= start))]
    selected.sort(key=lambda e: stamp(e['requestedAt'] or e['startedAt']), reverse=True)
    return {'items': [effect(store, kind, e, now, max_gap_seconds, include_samples=event_id is not None) for e in selected[:100]], 'total': len(selected), 'limit': 100}
