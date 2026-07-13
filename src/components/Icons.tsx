import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Activity = (props: IconProps) => <Icon {...props}><path d="M3 12h4l3-8 4 16 3-8h4" /></Icon>;
export const AlertTriangle = (props: IconProps) => <Icon {...props}><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5" /><path d="M12 18h.01" /></Icon>;
export const ArrowDownRight = (props: IconProps) => <Icon {...props}><path d="M7 7h10v10" /><path d="m7 17 10-10" /></Icon>;
export const ArrowUpRight = (props: IconProps) => <Icon {...props}><path d="M7 17h10V7" /><path d="m7 7 10 10" /></Icon>;
export const Battery = (props: IconProps) => <Icon {...props}><rect x="3" y="7" width="16" height="10" rx="2" /><path d="M21 11v2" /><path d="M7 11h6" /></Icon>;
export const Bot = (props: IconProps) => <Icon {...props}><rect x="5" y="8" width="14" height="10" rx="3" /><path d="M12 4v4" /><path d="M9 13h.01" /><path d="M15 13h.01" /></Icon>;
export const BrainCircuit = (props: IconProps) => <Icon {...props}><path d="M9 4a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4" /><path d="M15 4a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4" /><path d="M9 8h6" /><path d="M9 12h3" /><path d="M12 16h3" /></Icon>;
export const Camera = (props: IconProps) => <Icon {...props}><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="3" /></Icon>;
export const CheckCircle2 = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>;
export const Cpu = (props: IconProps) => <Icon {...props}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></Icon>;
export const Droplets = (props: IconProps) => <Icon {...props}><path d="M7 3C5 6 4 8 4 10a3 3 0 0 0 6 0C10 8 9 6 7 3Z" /><path d="M17 7c-2 3-3 5-3 7a3 3 0 0 0 6 0c0-2-1-4-3-7Z" /></Icon>;
export const Fan = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="2" /><path d="M12 10c2-5 7-5 8-2 1 3-2 5-6 5" /><path d="M14 13c4 3 2 8-1 8-3 0-4-4-2-7" /><path d="M10 13c-5 2-8-2-6-5 2-3 6-1 7 2" /></Icon>;
export const Gauge = (props: IconProps) => <Icon {...props}><path d="M4 14a8 8 0 1 1 16 0" /><path d="m12 14 4-4" /><path d="M12 14h.01" /></Icon>;
export const Leaf = (props: IconProps) => <Icon {...props}><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z" /><path d="M5 19 19 5" /></Icon>;
export const Lightbulb = (props: IconProps) => <Icon {...props}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8 14a6 6 0 1 1 8 0c-.8.7-1 1.4-1 2H9c0-.6-.2-1.3-1-2Z" /></Icon>;
export const Loader2 = (props: IconProps) => <Icon {...props}><path d="M21 12a9 9 0 1 1-6-8.5" /></Icon>;
export const Presentation = (props: IconProps) => <Icon {...props}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v5" /><path d="m8 21 4-4 4 4" /></Icon>;
export const RadioTower = (props: IconProps) => <Icon {...props}><path d="M12 10v11" /><path d="m8 21 4-11 4 11" /><path d="M8 8a5 5 0 0 1 8 0" /><path d="M5 5a9 9 0 0 1 14 0" /></Icon>;
export const ShieldAlert = (props: IconProps) => <Icon {...props}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" /><path d="M12 8v5" /><path d="M12 17h.01" /></Icon>;
export const SlidersHorizontal = (props: IconProps) => <Icon {...props}><path d="M3 6h12" /><path d="M19 6h2" /><circle cx="17" cy="6" r="2" /><path d="M3 12h2" /><path d="M9 12h12" /><circle cx="7" cy="12" r="2" /><path d="M3 18h12" /><path d="M19 18h2" /><circle cx="17" cy="18" r="2" /></Icon>;
export const Sprout = (props: IconProps) => <Icon {...props}><path d="M12 21V10" /><path d="M12 10C8 10 5 7 5 3c4 0 7 3 7 7Z" /><path d="M12 12c4 0 7-3 7-7-4 0-7 3-7 7Z" /></Icon>;
export const SunMedium = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></Icon>;
export const Thermometer = (props: IconProps) => <Icon {...props}><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" /></Icon>;
export const ToggleLeft = (props: IconProps) => <Icon {...props}><rect x="3" y="7" width="18" height="10" rx="5" /><circle cx="8" cy="12" r="2" /></Icon>;
export const Upload = (props: IconProps) => <Icon {...props}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></Icon>;
export const Wind = (props: IconProps) => <Icon {...props}><path d="M3 8h12a3 3 0 1 0-3-3" /><path d="M3 12h17" /><path d="M3 16h12a3 3 0 1 1-3 3" /></Icon>;
