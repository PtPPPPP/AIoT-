import { ArrowDownRight, ArrowUpRight } from './Icons';
import { RiskLevel } from '../types';

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  risk?: RiskLevel;
  trend?: 'up' | 'down';
};

export function MetricCard({ label, value, unit, hint, risk = '正常', trend = 'up' }: MetricCardProps) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;
  return (
    <section className={`metric-card ${risk !== '正常' ? 'is-alert' : ''}`}>
      <div className="metric-head">
        <span>{label}</span>
        <span className={`risk-dot ${riskClass(risk)}`}>{risk}</span>
      </div>
      <div className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <p><TrendIcon size={15} />{hint}</p>
    </section>
  );
}

function riskClass(risk: RiskLevel) {
  if (risk === '不可用') return 'muted';
  if (risk === '高风险') return 'danger';
  if (risk === '中风险') return 'warning';
  if (risk === '关注') return 'notice';
  return 'good';
}
