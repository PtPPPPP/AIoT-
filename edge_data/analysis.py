"""Time-based analytics over original samples. No extrapolation across missing data."""
from collections import defaultdict

from .common import METRICS, iso, stamp


def event_markers(events):
    """Compact repeated polling feedback; preserve both sides of transitions and all interventions."""
    retained, previous = {}, {}
    for event in events:
        if event['kind'] != 'feedback':
            retained[event['id']] = event
            continue
        key = (event['zoneId'], event.get('device'))
        old = previous.get(key)
        if old is None or (old.get('actual'), old.get('feedbackLevel')) != (event.get('actual'), event.get('feedbackLevel')):
            if old:
                retained[old['id']] = old
            retained[event['id']] = event
        previous[key] = event
    for last in previous.values():
        retained[last['id']] = last
    return sorted(retained.values(), key=lambda e: (e['observedAt'], e['id']))


def context_at(contexts, at):
    candidates = [c for c in contexts if stamp(c['effectiveAt']) <= at]
    return candidates[-1] if candidates else None


def gap_limit(contexts, at, default):
    context = context_at(contexts, at)
    return (context.get('analysis', {}).get('maxGapSeconds') or default) * 1000 if context else default * 1000


def interpolate(left, right, at):
    start, end = stamp(left['capturedAt']), stamp(right['capturedAt'])
    return left['value'] + (right['value'] - left['value']) * (at - start) / (end - start)


def segments(samples, start, end, contexts, max_gap_seconds):
    """Call with one metric/sensor/unit sequence, including boundary observations."""
    result = []
    ordered = sorted(samples, key=lambda s: stamp(s['capturedAt']))
    for left, right in zip(ordered, ordered[1:]):
        a, b = stamp(left['capturedAt']), stamp(right['capturedAt'])
        if left['quality'] != 'good' or right['quality'] != 'good' or left['value'] is None or right['value'] is None or b <= a:
            continue
        if left['sensorId'] != right['sensorId'] or left['unit'] != right['unit'] or left['key'] != right['key']:
            continue
        limits = [gap_limit(contexts, at, max_gap_seconds) for at in [a, b] + [stamp(c['effectiveAt']) for c in contexts if a < stamp(c['effectiveAt']) < b]]
        if b - a > min(limits):
            continue
        lo, hi = max(a, start), min(b, end)
        if lo < hi:
            result.append({'start': lo, 'end': hi, 'left': interpolate(left, right, lo), 'right': interpolate(left, right, hi), 'ids': [left['id'], right['id']]})
    return result


def missing_periods(intervals, start, end):
    missing, cursor = [], start
    for item in sorted(intervals, key=lambda s: s['start']):
        if item['start'] > cursor:
            missing.append({'from': iso(cursor), 'to': iso(item['start']), 'seconds': (item['start'] - cursor) / 1000})
        cursor = max(cursor, item['end'])
    if cursor < end:
        missing.append({'from': iso(cursor), 'to': iso(end), 'seconds': (end - cursor) / 1000})
    return missing


def describe_series(samples, start, end, contexts, max_gap_seconds):
    if not samples:
        return None
    first = samples[0]
    expected_unit = METRICS[first['key']]
    valid = [s for s in samples if s['quality'] == 'good' and s['value'] is not None and start <= stamp(s['capturedAt']) <= end]
    pieces = segments(samples, start, end, contexts, max_gap_seconds)
    covered = sum(p['end'] - p['start'] for p in pieces)
    integral = sum((p['left'] + p['right']) / 2 * (p['end'] - p['start']) for p in pieces)
    in_target = out_target = unconfigured = longest = run = 0
    previous_out_end = None
    used_versions = set()
    for piece in pieces:
        cuts = sorted(set([piece['start'], piece['end']] + [stamp(c['effectiveAt']) for c in contexts if piece['start'] < stamp(c['effectiveAt']) < piece['end']]))
        for a, b in zip(cuts, cuts[1:]):
            context = context_at(contexts, a)
            target = context.get('targets', {}).get(first['key']) if context else None
            if not target or target.get('confirmed') is not True or target.get('unit') != expected_unit:
                unconfigured += b - a
                run = 0; previous_out_end = None
                continue
            used_versions.add(context['version'])
            def value_at(at):
                return piece['left'] + (piece['right'] - piece['left']) * (at - piece['start']) / (piece['end'] - piece['start'])
            partitions = [a, b]
            if piece['left'] != piece['right']:
                for threshold in (target['low'], target['high']):
                    cross = piece['start'] + (threshold - piece['left']) / (piece['right'] - piece['left']) * (piece['end'] - piece['start'])
                    if a < cross < b:
                        partitions.append(cross)
            partitions.sort()
            for lo, hi in zip(partitions, partitions[1:]):
                value = value_at((lo + hi) / 2)
                if target['low'] <= value <= target['high']:
                    in_target += hi - lo; run = 0; previous_out_end = None
                else:
                    out_target += hi - lo
                    run = run + hi - lo if previous_out_end == lo else hi - lo
                    previous_out_end = hi
                    longest = max(longest, run)
    last = pieces[-1] if pieces else None
    minimum = min(valid, key=lambda s: s['value']) if valid else None
    maximum = max(valid, key=lambda s: s['value']) if valid else None
    total = max(0, end - start)
    return {
        'metric': first['key'], 'sensorId': first['sensorId'], 'unit': expected_unit, 'sourceKind': first['sourceKind'],
        'sampleCount': sum(start <= stamp(s['capturedAt']) <= end for s in samples), 'validSampleCount': len(valid),
        'minimum': {'value': minimum['value'], 'at': minimum['capturedAt'], 'sampleId': minimum['id']} if minimum else None,
        'maximum': {'value': maximum['value'], 'at': maximum['capturedAt'], 'sampleId': maximum['id']} if maximum else None,
        'timeWeightedMean': integral / covered if covered else None,
        'coverage': covered / total if total else 0, 'denominatorSeconds': total / 1000,
        'validSeconds': covered / 1000, 'unknownSeconds': (total - covered) / 1000,
        'targetInSeconds': in_target / 1000 if used_versions else None,
        'targetOutSeconds': out_target / 1000 if used_versions else None,
        'targetUnknownSeconds': (total - in_target - out_target) / 1000,
        'targetUnconfiguredValidSeconds': unconfigured / 1000, 'longestOutSeconds': longest / 1000 if used_versions else None,
        'targetVersions': sorted(used_versions), 'missingPeriods': missing_periods(pieces, start, end),
        'changeRatePerHour': (last['right'] - last['left']) / (last['end'] - last['start']) * 3600000 if last else None,
        'rateFrom': iso(last['start']) if last else None, 'rateTo': iso(last['end']) if last else None,
        'reason': '无相邻有效采样或采样间隔超过连接上限，无法计算时长与时间加权均值' if not covered else '目标区间未配置，仅提供描述统计' if not used_versions else None,
    }


def report(store, kind, zone, start, end, max_gap_seconds, timezone):
    contexts = store.contexts(kind, zone)
    boundary_gap = max([max_gap_seconds] + [c.get('analysis', {}).get('maxGapSeconds') or max_gap_seconds for c in contexts]) * 1000
    raw = store.samples(kind, zone, start - boundary_gap, end + boundary_gap)
    groups = defaultdict(list)
    for sample in raw:
        groups[(sample['key'], sample['sensorId'])].append(sample)
    metrics = [describe_series(items, start, end, contexts, max_gap_seconds) for items in groups.values()]
    present = {m['metric'] for m in metrics}
    for metric, unit in METRICS.items():
        if metric not in present:
            metrics.append({'metric': metric, 'sensorId': None, 'unit': unit, 'sourceKind': kind, 'sampleCount': 0, 'validSampleCount': 0,
                            'coverage': 0, 'denominatorSeconds': (end - start) / 1000, 'validSeconds': 0, 'unknownSeconds': (end - start) / 1000,
                            'minimum': None, 'maximum': None, 'timeWeightedMean': None, 'targetInSeconds': None, 'targetOutSeconds': None,
                            'targetUnknownSeconds': (end - start) / 1000, 'targetUnconfiguredValidSeconds': 0, 'longestOutSeconds': None, 'targetVersions': [],
                            'changeRatePerHour': None, 'rateFrom': None, 'rateTo': None,
                            'missingPeriods': [{'from': iso(start), 'to': iso(end), 'seconds': (end - start) / 1000}], 'reason': '该指标没有历史采样'})
    return {'dataset': kind, 'zoneId': zone, 'from': iso(start), 'to': iso(end), 'timezone': timezone, 'metrics': metrics, 'contexts': contexts,
            'method': '相邻有效样本分段线性插值、梯形时间积分；无效记录打断序列；超过最大间隔不连接；不向两端外推。目标按生效版本与跨阈值时刻分段。最小最大值为范围内原始有效采样；变化速率来自最后一段有效相邻观测。',
            'maxGapSeconds': max_gap_seconds, 'sampleCount': sum(start <= stamp(s['capturedAt']) <= end for s in raw)}
