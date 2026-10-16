import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'celebrate' | 'social' | 'calm' | 'neutral';
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('hb-badge', `hb-badge--${tone}`, className)} {...rest} />;
}
