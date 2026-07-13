import { Alarm, Device, DeviceStates, Reading } from '../types';

export const initialReading: Reading = {
  time: '09:00',
  temperature: 28.4,
  humidity: 64,
  light: 18600,
  soilMoisture: 41,
  co2: 760,
};

export const initialDeviceStates: DeviceStates = {
  waterPump: false,
  fan: true,
  growLight: false,
  shade: false,
};

export const initialDevices: Device[] = [
  { id: 'SEN-T-01', name: '温湿度传感器', kind: 'sensor', location: 'A区顶部', online: true, battery: 88, updatedAt: '刚刚' },
  { id: 'SEN-L-02', name: '光照传感器', kind: 'sensor', location: 'A区中部', online: true, battery: 76, updatedAt: '刚刚' },
  { id: 'SEN-S-03', name: '土壤湿度传感器', kind: 'sensor', location: 'B区苗床', online: true, battery: 82, updatedAt: '1分钟前' },
  { id: 'SEN-C-04', name: 'CO₂传感器', kind: 'sensor', location: '主通道', online: true, battery: 69, updatedAt: '2分钟前' },
  { id: 'CAM-AI-01', name: 'AI作物摄像头', kind: 'camera', location: '番茄架上方', online: true, battery: 91, updatedAt: '刚刚' },
  { id: 'ACT-P-01', name: '滴灌水泵', kind: 'actuator', location: '水肥一体机', online: true, running: false, updatedAt: '刚刚' },
  { id: 'ACT-F-02', name: '排风风扇', kind: 'actuator', location: '北侧风口', online: true, running: true, updatedAt: '刚刚' },
  { id: 'ACT-L-03', name: 'LED补光灯', kind: 'actuator', location: 'A区棚顶', online: true, running: false, updatedAt: '3分钟前' },
  { id: 'GW-01', name: 'LoRa/4G网关', kind: 'gateway', location: '控制柜', online: true, battery: 100, updatedAt: '刚刚' },
];

export const initialAlarms: Alarm[] = [
  {
    id: 'alarm-1',
    time: '08:42',
    type: '土壤缺水',
    source: 'SEN-S-03',
    level: '中风险',
    message: 'B区苗床土壤湿度低于 35%，建议开启滴灌水泵。',
    handled: false,
  },
  {
    id: 'alarm-2',
    time: '08:15',
    type: '病害风险',
    source: 'CAM-AI-01',
    level: '关注',
    message: 'AI识别到少量叶片黄化，建议复查叶背和通风情况。',
    handled: true,
  },
];

export const aiSamples = [
  {
    id: 'green-tomato',
    name: '温室绿色番茄',
    image: 'linear-gradient(135deg, #7cc86b, #e2f7c2 48%, #347a4a)',
  },
  {
    id: 'leaf-risk',
    name: '叶片疑似病斑',
    image: 'linear-gradient(135deg, #386b35, #d7b66c 50%, #5e3f24)',
  },
  {
    id: 'seedling',
    name: '幼苗长势评估',
    image: 'linear-gradient(135deg, #d9f99d, #86efac 42%, #0f766e)',
  },
];

export const controlRules = [
  { rule: '土壤湿度低于 36%', action: '自动开启滴灌水泵', target: '补水至 45% 后关闭' },
  { rule: '温度高于 31°C', action: '自动开启排风风扇', target: '降温并稳定湿度' },
  { rule: '光照低于 12000 lux', action: '自动开启 LED 补光灯', target: '保障番茄光合作用' },
  { rule: '光照高于 33000 lux', action: '自动放下遮阳设备', target: '减少灼伤和蒸腾损失' },
];

export const projectBullets = [
  '以温室绿色番茄识别和智能估产为核心场景，扩展到环境监测和自动控制。',
  '采用轻量化视觉模型思路，突出低算力、低成本、可部署到边缘设备的特点。',
  '融合摄像头、温湿度、光照、土壤湿度、CO₂等多源数据，形成远程可视化管理。',
  '通过阈值策略和设备执行状态，演示数据采集、AI分析、自动执行、反馈优化闭环。',
];
