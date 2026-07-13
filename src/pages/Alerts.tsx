import { CheckCircle2 } from '../components/Icons';
import { Badge } from '../components/Status';
import { Alarm } from '../types';

type AlertsProps = {
  alarms: Alarm[];
  markAlarmHandled: (id: string) => void;
};

export function Alerts({ alarms, markAlarmHandled }: AlertsProps) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>异常预警中心</h2>
          <p>报警来自环境阈值、设备状态和 AI 作物识别。</p>
        </div>
        <Badge tone={alarms.some((alarm) => !alarm.handled) ? 'warn' : 'good'}>
          未处理 {alarms.filter((alarm) => !alarm.handled).length}
        </Badge>
      </div>

      <div className="table alarm-table">
        <div className="table-row table-head">
          <span>时间</span><span>异常类型</span><span>来源</span><span>风险</span><span>说明</span><span>处理</span>
        </div>
        {alarms.map((alarm) => (
          <div className={`table-row ${alarm.handled ? 'handled' : 'row-alert'}`} key={alarm.id}>
            <span>{alarm.time}</span>
            <strong>{alarm.type}</strong>
            <span>{alarm.source}</span>
            <Badge tone={alarm.level === '高风险' ? 'danger' : alarm.level === '中风险' ? 'warn' : 'blue'}>
              {alarm.level}
            </Badge>
            <span>{alarm.message}</span>
            {alarm.handled ? (
              <Badge tone="good">已处理</Badge>
            ) : (
              <button className="text-button" onClick={() => markAlarmHandled(alarm.id)}>
                <CheckCircle2 size={16} /> 标记处理
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
