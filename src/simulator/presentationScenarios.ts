import { initialReading } from '../data/mockData';
import { Device, PresentationFault, PresentationScenarioId, PresentationState, Reading, SimulatorState } from '../types';
import { seedToState } from './random';

export type PresentationScenario = {
  id: PresentationScenarioId;
  name: string;
  description: string;
};

export const presentationScenarios: PresentationScenario[] = [
  { id: 'normal', name: '正常运行', description: '所有设备在线，环境维持在合理区间。' },
  { id: 'soil-drought', name: '土壤干旱', description: '低湿度触发灌溉，随后水分恢复。' },
  { id: 'high-heat-co2', name: '高温高 CO₂', description: '通风策略启动，环境逐步恢复。' },
  { id: 'sensor-offline', name: '传感器离线', description: '土壤传感器离线后停止参与自动灌溉判断。' },
  { id: 'water-pump-failure', name: '水泵故障', description: '存在灌溉需求，但水泵离线导致执行失败。' },
];

export function createPresentationState(
  scenarioId: PresentationScenarioId = 'normal',
  seed = 'GREENHOUSE-2026',
  runStatus: PresentationState['runStatus'] = 'running',
): PresentationState {
  return {
    scenarioId,
    runStatus,
    step: 0,
    seed,
    randomState: seedToState(seed),
    stage: scenarioId === 'normal' ? '稳定运行' : '准备触发',
    fault: 'none',
  };
}

const setDeviceOnline = (devices: Device[], id: string, online: boolean, now: string) => devices.map((device) => (
  device.id === id ? { ...device, online, updatedAt: now } : device
));

const setReading = (reading: Reading, values: Partial<Pick<Reading, 'temperature' | 'humidity' | 'light' | 'soilMoisture' | 'co2'>>) => ({
  ...reading,
  ...values,
});

function scenarioStage(scenarioId: PresentationScenarioId, step: number): string {
  if (scenarioId === 'normal') return '稳定运行';
  if (scenarioId === 'soil-drought') return step === 0 ? '触发干旱' : step < 4 ? '灌溉恢复' : '报警解除';
  if (scenarioId === 'high-heat-co2') return step === 0 ? '触发异常' : step < 4 ? '通风恢复' : '报警解除';
  if (scenarioId === 'sensor-offline') return step < 3 ? '传感器离线' : '重新上线';
  return step < 3 ? '水泵执行失败' : '故障恢复';
}

export function preparePresentationFrame(state: SimulatorState, now: string): SimulatorState {
  const { scenarioId, step } = state.presentation;
  let reading = { ...state.reading };
  let devices = state.devices.map((device) => ({ ...device }));
  let fault: PresentationFault = 'none';

  if (scenarioId === 'normal') {
    reading = setReading(reading, { ...initialReading });
  }

  if (scenarioId === 'soil-drought') {
    const soilLevels = [34, 36, 40, 44, 46];
    reading = setReading(reading, { soilMoisture: soilLevels[Math.min(step, soilLevels.length - 1)] });
  }

  if (scenarioId === 'high-heat-co2') {
    const levels = [
      { temperature: 33.2, co2: 1_115 },
      { temperature: 31.8, co2: 1_040 },
      { temperature: 29.2, co2: 880 },
      { temperature: 28, co2: 840 },
    ];
    reading = setReading(reading, levels[Math.min(step, levels.length - 1)]);
  }

  if (scenarioId === 'sensor-offline') {
    const online = step >= 3;
    devices = setDeviceOnline(devices, 'SEN-S-03', online, now);
    fault = online ? 'none' : 'soil-sensor-offline';
  }

  if (scenarioId === 'water-pump-failure') {
    const online = step >= 3;
    devices = setDeviceOnline(devices, 'ACT-P-01', online, now);
    reading = setReading(reading, { soilMoisture: step < 3 ? 34 : 36 });
    fault = online ? 'none' : 'water-pump-offline';
  }

  return {
    ...state,
    reading,
    devices,
    presentation: {
      ...state.presentation,
      stage: scenarioStage(scenarioId, step),
      fault,
    },
  };
}
