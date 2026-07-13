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
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={`switch ${checked ? 'on' : ''}`} onClick={onChange} disabled={disabled}>
      <span />
    </button>
  );
}
