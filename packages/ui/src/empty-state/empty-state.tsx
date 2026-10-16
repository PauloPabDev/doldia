import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icon/icon';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="hb-empty">
      <span className="hb-empty__art" aria-hidden="true">
        <Icon name={icon} size={36} />
      </span>
      <h2 className="hb-empty__title">{title}</h2>
      {body && <p className="hb-empty__body">{body}</p>}
      {action}
    </div>
  );
}
