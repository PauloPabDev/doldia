import type { SVGProps } from 'react';

/** Iconos de trazo redondeado de 24 px, inline y sin librerías. */
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z',
  users:
    'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.5a4 4 0 010 7.5M22 21v-1a6 6 0 00-4-5.6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  user: 'M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM4 21a8 8 0 0116 0',
  bell: 'M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0',
  flame:
    'M12 22c4 0 7-2.8 7-6.8 0-3.7-2.4-6-4.3-8.2-.4 2.2-1.6 3.5-2.9 3.5.6-3.3-.6-6.3-3.3-8.5.2 3.6-3.5 6.4-3.5 11.2C5 19.2 8 22 12 22z',
  shield: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M19 19v2H6',
  run: 'M13 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM6 21l3-6 3 2v5M9 15l1.5-6 3.5 2 3 3M10.5 9L7 10.5V14',
  leaf: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l7-7',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  wave: 'M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-3 5 0',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  feather: 'M20 4C12 4 6 10 6 18v2M6 18l8-8M9 15h6M11 12h5',
  seed: 'M12 20v-6M12 14c-4 0-6-3-6-7 4 0 6 3 6 7zM12 14c4 0 6-3 6-7-4 0-6 3-6 7z',
  sprout: 'M12 21v-9M12 12C12 8 9 5 4 5c0 4 3 7 8 7zM12 14c0-3 2.5-6 7-6 0 4-3 6-7 6z',
  tree: 'M12 22v-6M7 16h10l-5-13z',
  mountain: 'M3 20l6.5-11 4 6 2.5-4L21 20z',
  sunrise: 'M4 18h16M7 18a5 5 0 0110 0M12 4v4M5 9l2 2M19 9l-2 2M2 22h20',
  hands:
    'M8 13V6.5a1.5 1.5 0 013 0V12M11 11V5a1.5 1.5 0 013 0v6M14 11V7a1.5 1.5 0 013 0v7a7 7 0 01-7 7 6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.5L8 15',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-right': 'M9 5l7 7-7 7',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  offline: 'M2 8.5a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19h.01M3 3l18 18',
  hand: 'M7 11V6a1.5 1.5 0 013 0v5M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V13M16 9.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-2.7L3.5 15a1.5 1.5 0 012.6-1.5L7 15',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
  logout: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3',
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Texto para lectores de pantalla; sin él, el icono es decorativo. */
  label?: string;
}

export function Icon({ name, size = 24, label, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `hb-icon ${className}` : 'hb-icon'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
