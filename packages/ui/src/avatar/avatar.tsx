import { cx } from '../cx';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Iluminado: ya registró hoy (racha de grupo). */
  lit?: boolean;
  className?: string;
}

const HUES = [160, 210, 20, 280, 40, 330, 190, 100];

function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Avatar({ name, size = 'md', lit, className }: AvatarProps) {
  return (
    <span
      className={cx('hb-avatar', `hb-avatar--${size}`, lit && 'hb-avatar--lit', className)}
      style={{ '--avatar-hue': hueFor(name) } as React.CSSProperties}
      role="img"
      aria-label={lit ? `${name}, ya registró hoy` : name}
    >
      {initials(name)}
    </span>
  );
}
