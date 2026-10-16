'use client';

import { cx, Icon, type IconName } from '@habitos/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUnread } from './notifications-listener';

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/hoy', label: 'Hoy', icon: 'home' },
  { href: '/pactos', label: 'Pactos', icon: 'users' },
  { href: '/progreso', label: 'Progreso', icon: 'chart' },
  { href: '/perfil', label: 'Perfil', icon: 'user' },
];

/** Barra inferior flotante: se oculta al bajar y vuelve al subir. */
export function AppNav() {
  const pathname = usePathname();
  const unread = useUnread();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 80);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tab = (t: (typeof TABS)[number]) => {
    const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
    return (
      <Link
        key={t.href}
        href={t.href}
        className={cx('nav__tab', active && 'nav__tab--active')}
        aria-current={active ? 'page' : undefined}
      >
        <span className="nav__icon">
          <Icon name={t.icon} />
          {t.href === '/perfil' && unread > 0 && (
            <span className="nav__badge">
              <span aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
              <span className="hb-visually-hidden">, {unread} notificaciones sin leer</span>
            </span>
          )}
        </span>
        <span>{t.label}</span>
      </Link>
    );
  };

  return (
    <nav className={cx('nav', hidden && 'nav--hidden')} aria-label="Principal">
      {TABS.slice(0, 2).map(tab)}
      <Link href="/habitos/nuevo" className="nav__create" aria-label="Crear hábito">
        <Icon name="plus" size={28} />
      </Link>
      {TABS.slice(2).map(tab)}
    </nav>
  );
}
