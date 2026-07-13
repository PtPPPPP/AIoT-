import { projectBullets } from '../data/mockData';

export function ProjectIntro() {
  return (
    <div className="intro-page">
      <section className="intro-hero">
        <h2>AIoT 智慧温室种植系统</h2>
        <p>
          本项目面向校园实验温室、家庭种植、小型农业园区和设施农业场景，建设一套集环境监测、作物识别、异常预警和自动控制于一体的智慧温室原型。系统通过温湿度、光照、土壤湿度、CO₂等传感器采集环境数据，结合摄像头图像和轻量化 AI 识别思路，对作物长势、叶片健康和病害风险进行分析，并根据阈值策略自动控制滴灌水泵、排风风扇、LED补光灯和遮阳设备，形成“数据采集—智能分析—自动执行—反馈优化”的闭环。项目借鉴温室绿色番茄识别和 YieldNet 轻量化视觉模型方案，强调低成本、低算力、易部署，可在没有真实硬件的阶段通过模拟数据完成答辩演示。预期成果包括可运行的可视化管理平台、AI识别演示流程、设备联动控制策略和节水节能评估指标，为智慧农业教学、科研展示和小规模落地应用提供样板。
        </p>
      </section>

      <section className="intro-grid">
        <InfoBlock title="背景与意义" text="传统温室依赖人工经验，环境异常和病害发现不及时，容易造成水电浪费和产量损失。" />
        <InfoBlock title="系统架构" text="感知层采集传感器与图像数据，平台层进行可视化和 AI 分析，执行层控制水泵、风扇、补光灯和遮阳设备。" />
        <InfoBlock title="核心功能" text="数据大屏、环境监测、智能控制、AI作物识别、报警中心、设备管理和项目展示。" />
        <InfoBlock title="创新点" text="多源 IoT 监测、轻量化 AI 识别、自动控制闭环、节水节能指标和比赛演示友好的模拟系统。" />
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
