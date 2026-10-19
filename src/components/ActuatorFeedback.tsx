import { ActuatorState } from '../types';
import { actualLabel, executionLabels, feedbackLabel, feedbackStale } from '../utils/runtimeStatus';
import { formatTimestamp } from '../utils/greenhouse';

export function ActuatorFeedback({ state }: { state: ActuatorState }) {
  return <div className="feedback-summary">
    <strong>目标：{state.target ? '开启' : '关闭'} · 反馈：{actualLabel(state)}</strong>
    <span>命令：{state.feedbackLevel === 'simulation' && state.executionStatus === 'succeeded' ? '模拟执行成功' : executionLabels[state.executionStatus]}</span>
    <span>{feedbackLabel(state)}</span>
    {state.actualKnown && feedbackStale(state) && <span className="blocked-reason">反馈已过期，当前动作未确认；上方为最后已知状态</span>}
    <small>最后已知反馈：{state.actualUpdatedAt ? formatTimestamp(state.actualUpdatedAt) : '无有效时间'}</small>
    {state.blockedReason && <details><summary>控制限制或失败原因</summary><p className="blocked-reason">{state.blockedReason}</p></details>}
    {['failed', 'timed_out', 'rejected'].includes(state.executionStatus) && <small>保留最后已知状态，通信失败不代表设备停止。</small>}
  </div>;
}
