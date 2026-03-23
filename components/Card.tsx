import { ReactNode } from 'react';

interface CardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  variant?: 'default' | 'green' | 'red' | 'white' | 'dim';
  subtitle?: string;
}

const variantStyles: Record<string, { border: string; bg: string; valueColor: string; glow?: string }> = {
  default: {
    bg: 'bg-[#111]',
    border: 'border-white/10',
    valueColor: 'text-white',
  },
  green: {
    bg: 'bg-[#001a08]',
    border: 'border-[#00ff41]/30',
    valueColor: '',
    glow: '0 0 20px rgba(0,255,65,0.1)',
  },
  red: {
    bg: 'bg-[#1a0005]',
    border: 'border-[#ff0033]/30',
    valueColor: '',
    glow: '0 0 20px rgba(255,0,51,0.1)',
  },
  white: {
    bg: 'bg-[#111]',
    border: 'border-white/20',
    valueColor: 'text-white',
  },
  dim: {
    bg: 'bg-[#0d0d0d]',
    border: 'border-white/5',
    valueColor: 'text-white/70',
  },
};

export default function Card({ label, value, icon, variant = 'default', subtitle }: CardProps) {
  const style = variantStyles[variant];

  const valueEl = (variant === 'green' || variant === 'red') ? (
    <p
      className="text-2xl font-bold truncate font-mono"
      style={{
        color: variant === 'green' ? '#00ff41' : '#ff0033',
        textShadow: variant === 'green'
          ? '0 0 12px rgba(0,255,65,0.7)'
          : '0 0 12px rgba(255,0,51,0.7)',
      }}
    >
      {value}
    </p>
  ) : (
    <p className={`text-2xl font-bold truncate font-mono ${style.valueColor}`}>{value}</p>
  );

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-200 hover:scale-[1.02] ${style.bg} ${style.border}`}
      style={style.glow ? { boxShadow: style.glow } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">{label}</p>
          {valueEl}
          {subtitle && <p className="text-xs text-white/30 mt-1.5 truncate font-mono">{subtitle}</p>}
        </div>
        {icon && (
          <div className="shrink-0 w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
