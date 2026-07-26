import { projectBullets } from '../data/mockData';

export function ProjectIntro() {
  return (
    <div className="intro-page">
      <section className="intro-hero">
        <h2>AIoT 智慧温室种植系统</h2>
        <p>
          本项目是面向大创申报和现场答辩的前端演示原型。已实现模拟传感器数据、统一启停回差策略、目标与实际设备状态、离线控制失败、报警生命周期、本地状态保存和 AI 演示识别适配器。AI 结果来自明确的人工场景，不是 YOLO 或 YieldNet 真实推理；节水节能为模拟基线估算，不是现场计量。真实传感器、MQTT、WebSocket、后端数据库、真实模型和控制器仅保留接入方向，当前未落地。
        </p>
      </section>

      <section className="intro-grid">
        <InfoBlock title="背景与意义" text="传统温室依赖人工经验，环境异常和病害发现不及时，容易造成水电浪费和产量损失。" />
        <InfoBlock title="当前架构" text="纯前端模拟器生成单帧快照，页面展示数据、策略、设备和报警。未连接真实感知层和执行层。" />
        <InfoBlock title="核心功能" text="数据大屏、环境监测、智能控制、AI作物识别、报警中心、设备管理和项目展示。" />
        <InfoBlock title="演示价值" text="单帧状态一致、离线闭环、报警去重与恢复、可解释指标和诚实标注的 AI 演示适配器。" />
        <InfoBlock title="预期成果" text="形成可运行产品原型，支持现场答辩演示，并为后续接入真实硬件和模型预留接口。" />
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
