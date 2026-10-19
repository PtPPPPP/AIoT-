import { modeLabels, channelLabels } from '../utils/runtimeStatus';
import { projectBullets } from '../data/mockData';
import { edgeNodeTypeLabel } from '../config/edgeNodeConfig';
import { SimulatorState } from '../types';
import { HardwareOverview } from '../components/HardwareOverview';

export function ProjectIntro({ runtime }: { runtime: SimulatorState['runtime'] }) {
  return (
    <div className="intro-page">
      <section className="intro-hero">
        <h2>AIoT 智慧温室种植系统</h2>
        <p>
          本项目是基于研华远程 I/O 与可替换边缘计算节点的 AIoT 智慧温室原型。当前参考边缘节点为 {runtime.edgeNodeName}（{edgeNodeTypeLabel(runtime.edgeNodeType)}），运行模式为 {modeLabels[runtime.mode]}，网关状态为 {runtime.mode === 'external' ? channelLabels[runtime.dataChannelStatus] : '未使用外部网关'}，AI 来源为 {runtime.aiSourceLabel}。未收到真实网关状态前，不表示任何研华设备或真实 AI 模型已经连接。
        </p>
      </section>

      <HardwareOverview />

      <section className="intro-grid">
        <InfoBlock title="背景与意义" text="传统温室依赖人工经验，环境异常和病害发现不及时，容易造成水电浪费和产量损失。" />
        <InfoBlock title="当前架构" text="现场感知层、现场控制层、工业网络层、可替换边缘计算层和 React 应用展示层相互解耦；实际接入程度以当前配置、采样与设备反馈证据为准，仓库不能证明现场状态。" />
        <InfoBlock title="核心功能" text="数据大屏、环境监测、智能控制、AI作物识别、报警中心、设备管理和项目展示。" />
        <InfoBlock title="演示价值" text="单帧状态一致、离线闭环、报警去重与恢复、可解释指标和诚实标注的 AI 演示适配器。" />
        <InfoBlock title="研华硬件职责" text="现有 WISE-4012、ADAM-6050 和 EKI-2525 分别承担无线采集、数字输入输出和以太网交换。当前只完成规划与前端接口；WISE-4012 四路输入不足以同时采集全部五项模拟指标。" />
        <InfoBlock title="边缘迁移路线" text="当前参考使用 Windows 计算机，后续可迁移到 Jetson、工业计算机或其他兼容平台，不绑定特定开发板。" />
        <InfoBlock title="应用场景" text="校园实验温室、家庭种植、小型农业园区、设施农业和农业机器人协同作业展示。" />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>资料提炼依据</h2>
            <p>来自当前资料中的温室绿色番茄识别、轻量化模型和空地协同内容。</p>
          </div>
        </div>
        <div className="bullet-grid">
          {projectBullets.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="info-block">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
