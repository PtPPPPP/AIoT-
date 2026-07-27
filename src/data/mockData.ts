import {
  ActuatorStates,
  Alarm,
  DemoScenarioId,
  Device,
  DeviceTargets,
  Reading,
  SensorStates,
} from '../types';

export const initialTimestamp = '2026-01-01T09:00:00.000Z';

export const initialReading: Reading = {
  time: '09:00:00',
  capturedAt: initialTimestamp,
  temperature: 28.4,
  humidity: 64,
  light: 18_600,
  soilMoisture: 41,
  co2: 760,
};

export const initialSensorStates: SensorStates = {
  temperature: { sourceId: 'SEN-T-01', status: 'live', quality: 'good', lastValue: 28.4, lastUpdatedAt: initialTimestamp },
  humidity: { sourceId: 'SEN-T-01', status: 'live', quality: 'good', lastValue: 64, lastUpdatedAt: initialTimestamp },
  light: { sourceId: 'SEN-L-02', status: 'live', quality: 'good', lastValue: 18_600, lastUpdatedAt: initialTimestamp },
  soilMoisture: { sourceId: 'SEN-S-03', status: 'live', quality: 'good', lastValue: 41, lastUpdatedAt: initialTimestamp },
  co2: { sourceId: 'SEN-C-04', status: 'live', quality: 'good', lastValue: 760, lastUpdatedAt: initialTimestamp },
};

export const initialTargets: DeviceTargets = {
  waterPump: false,
  fan: false,
  growLight: false,
  shade: false,
};

export const initialActuators: ActuatorStates = {
  waterPump: { target: false, actual: false, actualKnown: true, commandStatus: 'applied', executionStatus: 'succeeded' },
  fan: { target: false, actual: false, actualKnown: true, commandStatus: 'applied', executionStatus: 'succeeded' },
  growLight: { target: false, actual: false, actualKnown: true, commandStatus: 'applied', executionStatus: 'succeeded' },
  shade: { target: false, actual: false, actualKnown: true, commandStatus: 'applied', executionStatus: 'succeeded' },
};

export const initialDevices: Device[] = [
  { id: 'SEN-T-01', name: '温湿度传感器', kind: 'sensor', location: 'A区顶部', online: true, battery: 88, updatedAt: initialTimestamp, sensorKeys: ['temperature', 'humidity'] },
  { id: 'SEN-L-02', name: '光照传感器', kind: 'sensor', location: 'A区中部', online: true, battery: 76, updatedAt: initialTimestamp, sensorKeys: ['light'] },
  { id: 'SEN-S-03', name: '土壤湿度传感器', kind: 'sensor', location: 'B区苗床', online: true, battery: 82, updatedAt: initialTimestamp, sensorKeys: ['soilMoisture'] },
  { id: 'SEN-C-04', name: 'CO₂传感器', kind: 'sensor', location: '主通道', online: true, battery: 69, updatedAt: initialTimestamp, sensorKeys: ['co2'] },
  { id: 'CAM-AI-01', name: 'AI作物摄像头', kind: 'camera', location: '番茄架上方', online: true, battery: 91, updatedAt: initialTimestamp },
  { id: 'ACT-P-01', name: '滴灌水泵', kind: 'actuator', location: '水肥一体机', online: true, updatedAt: initialTimestamp, actuatorKey: 'waterPump' },
  { id: 'ACT-F-02', name: '排风风扇', kind: 'actuator', location: '北侧风口', online: true, updatedAt: initialTimestamp, actuatorKey: 'fan' },
  { id: 'ACT-L-03', name: 'LED补光灯', kind: 'actuator', location: 'A区棚顶', online: true, updatedAt: initialTimestamp, actuatorKey: 'growLight' },
  { id: 'ACT-S-04', name: '遮阳设备', kind: 'actuator', location: '棚顶遮阳系统', online: true, updatedAt: initialTimestamp, actuatorKey: 'shade' },
  { id: 'GW-01', name: 'LoRa/4G网关', kind: 'gateway', location: '控制柜', online: true, battery: 100, updatedAt: initialTimestamp },
];

export const initialAlarms: Alarm[] = [
  {
    id: 'environment-soil-moisture:SEN-S-03',
    type: 'environment-soil-moisture',
    sourceId: 'SEN-S-03',
    level: 'warning',
    title: '土壤湿度偏低',
    description: '历史演示报警：B 区苗床曾低于告警阈值，当前已恢复。',
    status: 'resolved',
    firstTriggeredAt: '2026-01-01T08:42:00.000Z',
    lastTriggeredAt: '2026-01-01T08:45:00.000Z',
    occurrenceCount: 3,
    resolvedAt: '2026-01-01T08:47:00.000Z',
  },
];

export const demoScenarios: Array<{
  id: DemoScenarioId;
  name: string;
  description: string;
  image: string;
}> = [
  {
    id: 'healthy',
    name: '健康叶片演示',
    description: '手动选定的健康场景，不是模型判断。',
    image: 'linear-gradient(135deg, #7cc86b, #e2f7c2 48%, #347a4a)',
  },
  {
    id: 'early-risk',
    name: '早期病斑演示',
    description: '手动选定的早期风险场景，用于展示报警闭环。',
    image: 'linear-gradient(135deg, #386b35, #d7b66c 50%, #5e3f24)',
  },
  {
    id: 'severe-risk',
    name: '严重病害演示',
    description: '手动选定的严重风险场景，不代表真实识别结果。',
    image: 'linear-gradient(135deg, #5f3128, #d97706 48%, #7f1d1d)',
  },
];

export const projectBullets = [
  '已实现：前端可视化、传感器数据模拟、自动控制策略和报警闭环。',
  '已实现：目标状态与实际状态分离，能演示设备离线和控制失败。',
  '已实现：AI 演示适配器和明确场景选择，不冒充真实模型推理。',
  '未实现：真实传感器、MQTT、后端数据库、YOLO/YieldNet 推理和真实控制器。',
];
