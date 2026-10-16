import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: 'default' | 'accent' | 'celebrate' | 'social' | 'calm';
  as?: 'div' | 'section' | 'article';
}

export function Card({ tone = 'default', as: Tag = 'div', className, ...rest }: CardProps) {
  return (
    <Tag className={cx('hb-card', tone !== 'default' && `hb-card--${tone}`, className)} {...rest} />
  );
}
