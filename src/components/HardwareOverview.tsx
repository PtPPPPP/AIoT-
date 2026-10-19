import { hardwareInventory, hardwarePendingItems, hardwareTopology } from '../config/hardwareConfig';
import { wise4012ExampleMappings, adam6050OutputExampleMappings, adam6050InputExampleMappings } from '../integrations/advantech/ioMapping.example';
import { sensorLabels, deviceLabels } from '../simulator/policy';
import { Badge } from './Status';

const inputLabels = {
  waterPumpRunning: '水泵运行反馈',
  fanRunning: '风机运行反馈',
  shadeExtendedLimit: '遮阳伸展限位',
  shadeRetractedLimit: '遮阳收回限位',
  lowWaterLevel: '水箱低液位',
  emergencyStop: '急停',
  deviceFault: '设备故障',
};

export function HardwareOverview({ showMappings = false }: { showMappings?: boolean }) {
  return (
    <section className="panel hardware-overview" aria-label="现有硬件与接入规划">
      <div className="section-title">
        <div><h2>现有硬件与接入规划</h2><p>已持有三款设备，尚未完成实机接入；持有状态不代表在线，也不计入仿真在线率。</p></div>
        <Badge tone="warn">接线与通信待验证</Badge>
      </div>
      <div className="intro-grid">
        {hardwareInventory.map((hardware) => (
          <article className="info-block" key={hardware.model}>
            <h3>{hardware.model} · {hardware.role}</h3>
            <Badge tone="blue">已持有</Badge>
            <p>{hardware.capacity}</p><p>{hardware.connection}</p>
            <p>{hardware.plan}</p><p>{hardware.limitation}</p>
            <a href={hardware.sourceUrl} target="_blank" rel="noreferrer">研华规格资料</a>
          </article>
        ))}
      </div>
      <pre className="hardware-topology" aria-label="硬件网络拓扑">{hardwareTopology}</pre>
      <p>{hardwarePendingItems}</p>
      {showMappings && (
        <>
          <h3>建议 I/O 分配（全部禁用，待接线确认）</h3>
          <p>通道从 0 开始编号。4–20 mA 及工程量程仅为示例；DO 有效电平、安全状态和反馈关系需现场确认。</p>
          <div className="intro-grid">
            <div className="info-block">
              <h3>WISE-4012 输入</h3>
              {wise4012ExampleMappings.map((mapping) => (
                <p key={mapping.logicalKey}>{mapping.channelIndex === undefined ? '未分配' : `UI${mapping.channelIndex}`} · {sensorLabels[mapping.logicalKey]}{mapping.channelType === 'unassigned' ? '：4 路已占用，需扩展采集设备或调整指标' : ` · 示例 ${mapping.rawRange?.join('–')} mA → ${mapping.engineeringRange?.join('–')} ${mapping.unit}`}</p>
              ))}
              <p>DO0 / DO1 保留；输入切换为 DI 会占用同一路通用输入。</p>
            </div>
            <div className="info-block">
              <h3>ADAM-6050 输出</h3>
              {adam6050OutputExampleMappings.map((mapping) => (
                <p key={mapping.logicalDevice}>{mapping.outputChannel === undefined ? `DO${mapping.extendChannel} / DO${mapping.retractChannel}` : `DO${mapping.outputChannel}`} · {deviceLabels[mapping.logicalDevice]}</p>
              ))}
              <p>DO5 保留；输出回执不等同于设备运行反馈。</p>
            </div>
            <div className="info-block">
              <h3>ADAM-6050 输入</h3>
              {adam6050InputExampleMappings.map((mapping) => (
                <p key={mapping.logicalInput}>DI{mapping.inputChannel} · {inputLabels[mapping.logicalInput]}</p>
              ))}
              <p>DI7–DI11 保留；急停需由独立安全回路切断执行，DI 仅采集状态。</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
