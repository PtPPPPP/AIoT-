import { useState } from 'react';

const steps = [
  ['正常运行', '保持暂停，讲清“答辩仿真”和本地模拟数据通道。'],
  ['土壤干旱', '单步推进，观察土壤湿度、水泵目标和报警。'],
  ['水泵故障', '观察目标“开启”、实际“停止”和控制失败报警。'],
  ['传感器离线', '观察无数据、offline 质量和策略不再使用该读数。'],
  ['报警筛选与导出', '筛选后导出当前结果，说明 Excel 中文兼容。'],
  ['快照导出', '导出当前状态，必要时用答辩复位快速恢复。'],
];

export function DemoGuide() {
  const [open, setOpen] = useState(false);
  return <section className="panel demo-guide"><button type="button" className="text-button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? '收起' : '展开'}答辩演示指引</button>{open && <ol>{steps.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ol>}</section>;
}
