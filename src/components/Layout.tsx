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
import { PageKey } from '../types';

const navItems: Array<{ key: PageKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'dashboard', label: '数据总览', icon: Gauge },
  { key: 'environment', label: '环境监测', icon: Activity },
  { key: 'control', label: '智能控制', icon: SlidersHorizontal },
  { key: 'ai', label: 'AI识别', icon: Bot },
  { key: 'alerts', label: '报警中心', icon: AlertTriangle },
  { key: 'devices', label: '设备管理', icon: Cpu },
  { key: 'intro', label: '项目介绍', icon: Presentation },
];

type LayoutProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
  unresolvedCount: number;
  onlineRate: number;
  lastUpdatedAt: string;
  persistenceError: string | null;
  actionMessage: string | null;
  onReset: () => boolean;
};

export function Layout({
  currentPage,
  onNavigate,
  children,
  unresolvedCount,
  onlineRate,
  lastUpdatedAt,
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
          <strong>闭环演示中</strong>
          <span>采集 - 分析 - 执行 - 反馈</span>
          <button className="reset-button" onClick={onReset}>重置演示数据</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>AIoT 智慧温室种植系统</h1>
            <p>设施温室前端演示：环境、控制、报警与 AI 适配器</p>
          </div>
          <div className="topbar-status">
            <span className="status-pill blue">运行模式：答辩仿真</span>
            <span className="status-pill blue">数据：本地模拟通道</span>
            <span className="status-pill muted">控制：模拟设备通道</span>
            <span className="status-pill muted">真实硬件：未接入</span>
            <span className="status-pill good">设备在线率 {onlineRate}%</span>
            <span className={`status-pill ${unresolvedCount > 0 ? 'warn' : 'good'}`}>未解决报警 {unresolvedCount}</span>
            <span className="status-pill muted">数据更新 {new Date(lastUpdatedAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
          </div>
        </header>
        {persistenceError && <div className="notice danger" role="alert">{persistenceError}</div>}
        {actionMessage && <div className="notice good" role="status">{actionMessage}</div>}
        {children}
      </main>
    </div>
  );
}
