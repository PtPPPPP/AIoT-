import { useEffect, useMemo, useState } from 'react';
import { initialAlarms, initialDevices, initialDeviceStates, initialReading } from '../data/mockData';
import { Alarm, AiResult, DeviceStateKey, DeviceStates, Reading } from '../types';
import { decideAutoDevices, newAlarmsFromReading, nextReading } from '../utils/greenhouse';

const historySeed: Reading[] = Array.from({ length: 14 }, (_, index) => ({
  ...initialReading,
  time: `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  temperature: Number((25.5 + Math.sin(index / 2) * 2.7 + index * 0.12).toFixed(1)),
  humidity: Math.round(67 - index * 0.8 + Math.cos(index) * 2),
  light: Math.round(12000 + index * 1300 + Math.sin(index) * 1900),
  soilMoisture: Math.round(47 - index * 0.7 + Math.sin(index / 1.7) * 2),
  co2: Math.round(690 + index * 18 + Math.cos(index) * 25),
}));

export function useGreenhouseSimulator() {
  const [reading, setReading] = useState<Reading>(initialReading);
  const [history, setHistory] = useState<Reading[]>(historySeed);
  const [devices, setDevices] = useState(initialDevices);
  const [deviceStates, setDeviceStates] = useState<DeviceStates>(initialDeviceStates);
  const [autoMode, setAutoMode] = useState(true);
  const [alarms, setAlarms] = useState<Alarm[]>(initialAlarms);
  const [aiStage, setAiStage] = useState<'idle' | 'analyzing' | 'done'>('idle');
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReading((current) => {
        const simulated = nextReading(current, deviceStates);
        setHistory((items) => [...items.slice(-23), simulated]);
        setAlarms((items) => mergeAlarms(items, newAlarmsFromReading(simulated)));
        if (autoMode) {
          setDeviceStates(decideAutoDevices(simulated));
        }
        return simulated;
      });
      setDevices((items) =>
        items.map((device) => ({
          ...device,
          updatedAt: device.online ? '刚刚' : device.updatedAt,
          running: device.id === 'ACT-P-01' ? deviceStates.waterPump : device.id === 'ACT-F-02' ? deviceStates.fan : device.id === 'ACT-L-03' ? deviceStates.growLight : device.running,
        })),
      );
    }, 2600);

    return () => window.clearInterval(timer);
  }, [autoMode, deviceStates]);

  const stats = useMemo(() => {
    const unhandled = alarms.filter((alarm) => !alarm.handled).length;
    return {
      unhandled,
      irrigationCount: history.filter((item) => item.soilMoisture < 40).length + (deviceStates.waterPump ? 1 : 0),
      waterSaving: 31,
      energySaving: 24,
      onlineRate: Math.round((devices.filter((device) => device.online).length / devices.length) * 100),
    };
  }, [alarms, deviceStates.waterPump, devices, history]);

  const toggleDevice = (key: DeviceStateKey) => {
    setDeviceStates((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleDeviceOnline = (id: string) => {
    setDevices((items) =>
      items.map((device) =>
        device.id === id ? { ...device, online: !device.online, updatedAt: !device.online ? '刚刚' : '离线' } : device,
      ),
    );
  };

  const markAlarmHandled = (id: string) => {
    setAlarms((items) => items.map((alarm) => (alarm.id === id ? { ...alarm, handled: true } : alarm)));
  };

  const runAiAnalysis = (sampleName: string) => {
    setAiStage('analyzing');
    setAiResult(null);
    window.setTimeout(() => {
      const hasRisk = sampleName.includes('病斑');
      setAiResult({
        crop: sampleName,
        growth: hasRisk ? '长势偏弱，叶片局部黄化' : '长势良好，果实膨大稳定',
        health: hasRisk ? 72 : 91,
        disease: hasRisk ? '疑似早疫病/营养胁迫' : '未发现明显病害',
        risk: hasRisk ? '中风险' : '关注',
        suggestion: hasRisk
          ? '加强通风，复查叶背病斑，必要时进行定点处理并减少叶面潮湿时间。'
          : '维持当前滴灌和补光策略，继续监测果实数量与土壤湿度变化。',
      });
      setAiStage('done');
      if (hasRisk) {
        setAlarms((items) =>
          mergeAlarms(items, [
            {
              id: `ai-${Date.now()}`,
              time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: '病害风险',
              source: 'CAM-AI-01',
              level: '中风险',
              message: 'AI识别到叶片疑似病斑，建议人工复核并调整通风。',
              handled: false,
            },
          ]),
        );
      }
    }, 1600);
  };

  return {
    reading,
    history,
    devices,
    deviceStates,
    autoMode,
    alarms,
    aiStage,
    aiResult,
    stats,
    setAutoMode,
    toggleDevice,
    toggleDeviceOnline,
    markAlarmHandled,
    runAiAnalysis,
  };
}

function mergeAlarms(current: Alarm[], incoming: Alarm[]) {
  if (!incoming.length) return current;
  const existingTypes = new Set(current.filter((alarm) => !alarm.handled).map((alarm) => alarm.type));
  const fresh = incoming.filter((alarm) => !existingTypes.has(alarm.type));
  return [...fresh, ...current].slice(0, 18);
}
