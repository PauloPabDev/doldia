import { cx } from '../cx';
import { Icon, type IconName } from '../icon/icon';

export interface AchievementBadgeProps {
  title: string;
  icon: IconName;
  unlocked: boolean;
  description?: string;
}

export function AchievementBadge({ title, icon, unlocked, description }: AchievementBadgeProps) {
  return (
    <figure className={cx('hb-medal', !unlocked && 'hb-medal--locked')}>
      <span className="hb-medal__shape">
        <Icon name={icon} size={28} />
      </span>
      <figcaption className="hb-medal__title">
        {title}
        <span className="hb-visually-hidden">
          {unlocked ? ', desbloqueado' : ', por desbloquear'}
        </span>
        {description && <span className="hb-medal__description">{description}</span>}
      </figcaption>
    </figure>
  );
}
