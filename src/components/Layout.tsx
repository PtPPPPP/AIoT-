import {
  Activity,
  AlertTriangle,
  Bot,
  Cpu,
  Gauge,
  Leaf,
  Presentation,
  SlidersHorizontal,
  Sprout,
} from './Icons';
import type React from 'react';
import { RuntimeStatus } from './RuntimeStatus';
import { SensorStates, SimulatorState, PageKey } from '../types';

const navItems: Array<{ key: PageKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'dashboard', label: '数据总览', icon: Gauge },
  { key: 'environment', label: '环境监测', icon: Activity },
  { key: 'analysis', label: '数据分析', icon: Gauge },
  { key: 'control', label: '智能控制', icon: SlidersHorizontal },
  { key: 'ai', label: 'AI识别', icon: Bot },
  { key: 'alerts', label: '报警中心', icon: AlertTriangle },
  { key: 'devices', label: '设备管理', icon: Cpu },
  { key: 'intro', label: '项目介绍', icon: Presentation },
];

type LayoutProps = {
  runtime: SimulatorState['runtime'];
  sensors: SensorStates;
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
  unresolvedCount: number;
  persistenceError: string | null;
  actionMessage: string | null;
  onReset: () => boolean;
};

export function Layout({
  currentPage,
  onNavigate,
  children,
  unresolvedCount,
  runtime,
  sensors,
  persistenceError,
  actionMessage,
  onReset,
}: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sprout size={24} /></div>
          <div>
            <strong>AIoT 温室</strong>
            <span>Smart Greenhouse</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${currentPage === key ? 'active' : ''}`}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <Leaf size={18} />
          <strong>{runtime.mode === 'simulation' ? '仿真运行' : runtime.mode === 'playback' ? '回放查看' : '外部接入监测'}</strong>
          <span>采集 - 分析 - 执行 - 反馈</span>
          <button className="reset-button" onClick={onReset} disabled={runtime.mode !== 'simulation'}>重置演示数据</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>AIoT 智慧温室种植系统</h1>
            <p>环境异常、处置动作与执行反馈</p>
          </div>
          <div className="topbar-status">
            <RuntimeStatus runtime={runtime} sensors={sensors} />
            <span className="status-pill muted">未解决报警 {unresolvedCount}</span>
          </div>
        </header>
        {persistenceError && <div className="notice danger" role="alert">{persistenceError}</div>}
        {actionMessage && <div className="notice good" role="status">{actionMessage}</div>}
        {children}
      </main>
    </div>
  );
}
