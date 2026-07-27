import { runtimeConfig, RuntimeConfig } from '../config/runtimeConfig';
import { RuntimeMode } from '../types';
import { EdgeGatewayControlChannel } from './control/EdgeGatewayControlChannel';
import { DeviceControlChannel } from './control/types';
import { EdgeGatewayDataChannel } from './data/EdgeGatewayDataChannel';
import { SimulationDataChannel } from './data/SimulationDataChannel';
import { SensorDataChannel } from './data/types';
import { SimulationControlChannel } from './control/SimulationControlChannel';

export type RuntimeChannels = { dataChannel: SensorDataChannel; controlChannel: DeviceControlChannel; mode: RuntimeMode; dataSourceLabel: string; controlSourceLabel: string };
export function createRuntimeChannels(config: RuntimeConfig = runtimeConfig): RuntimeChannels {
  if (config.mode === 'external') return { dataChannel: new EdgeGatewayDataChannel(config), controlChannel: new EdgeGatewayControlChannel(config), mode: config.mode, dataSourceLabel: config.edgeApiBaseUrl ? '边缘网关' : '边缘网关未配置', controlSourceLabel: config.edgeApiBaseUrl ? '边缘网关控制通道' : '边缘网关未配置' };
  return { dataChannel: new SimulationDataChannel(), controlChannel: new SimulationControlChannel(), mode: config.mode, dataSourceLabel: config.mode === 'playback' ? '本地回放' : '本地模拟器', controlSourceLabel: config.mode === 'playback' ? '回放控制禁用' : '模拟设备通道' };
}
