type BadgeProps = {
  children: React.ReactNode;
  tone?: 'good' | 'warn' | 'danger' | 'muted' | 'blue';
};

export function Badge({ children, tone = 'muted' }: BadgeProps) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={onChange} disabled={disabled}>
      <span />
    </button>
  );
}
