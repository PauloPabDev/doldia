import type { ReactNode } from 'react';
import { Avatar } from '../avatar/avatar';

export interface PactFeedItemProps {
  name: string;
  habitTitle: string;
  status: 'done' | 'min' | 'relapse' | 'skip';
  kind: 'build' | 'break';
  when: string;
  note?: string | null;
  children?: ReactNode;
}

function verb(status: PactFeedItemProps['status'], kind: PactFeedItemProps['kind']) {
  if (kind === 'break')
    return status === 'relapse' ? 'tuvo un tropiezo con' : 'se mantuvo libre de';
  return status === 'min' ? 'hizo la versión de 2 min de' : 'cumplió';
}

export function PactFeedItem({
  name,
  habitTitle,
  status,
  kind,
  when,
  note,
  children,
}: PactFeedItemProps) {
  return (
    <li className="hb-feed-item">
      <Avatar name={name} size="md" />
      <div className="hb-feed-item__body">
        <p className="hb-feed-item__text">
          <strong>{name}</strong> {verb(status, kind)}{' '}
          <span className="hb-feed-item__habit">{habitTitle}</span>
        </p>
        {note && <p className="hb-feed-item__note">“{note}”</p>}
        <time className="hb-feed-item__when">{when}</time>
        {children}
      </div>
    </li>
  );
}
