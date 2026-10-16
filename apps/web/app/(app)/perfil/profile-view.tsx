'use client';

import { me as meSchema, type NotificationType, type UpdateMeInput } from '@habitos/contracts';
import { Avatar, Button, Card, Checkbox, Icon, Input, Select, useToast } from '@habitos/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUnread } from '@/components/notifications-listener';
import { useSession } from '@/components/session';
import { api, errorMessage } from '@/lib/api';
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIosWithoutInstall,
  pushSupported,
} from '@/lib/push';

const PREF_LABELS: Record<NotificationType, string> = {
  reminder: 'Recordatorios de mis hábitos',
  streak_risk: 'Aviso cuando mi racha está en riesgo',
  nudge: 'Empujones de amigos',
  reaction: 'Reacciones a mis registros',
  pact_member: 'Alguien entra a mi pacto',
  achievement: 'Logros y niveles',
  weekly_summary: 'Resumen semanal',
};

const ZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
];

function setCookie(name: string, value: string | null) {
  // biome-ignore lint/suspicious/noDocumentCookie: preferencia visual sin datos sensibles
  document.cookie = value
    ? `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
    : `${name}=; Path=/; Max-Age=0`;
}

export function ProfileView() {
  const { me, setMe } = useSession();
  const { show } = useToast();
  const unread = useUnread();
  const [push, setPush] = useState<'on' | 'off' | 'unsupported'>('off');
  const [theme, setTheme] = useState('system');
  const [name, setName] = useState(me.displayName);

  useEffect(() => {
    if (!pushSupported()) setPush('unsupported');
    else currentSubscription().then((s) => setPush(s ? 'on' : 'off'));
    setTheme(document.documentElement.dataset.theme ?? 'system');
  }, []);

  const update = async (patch: UpdateMeInput) => {
    try {
      setMe(await api('/me', { method: 'PATCH', body: patch, schema: meSchema }));
      show({ message: 'Guardado' });
    } catch (err) {
      show({ message: errorMessage(err), tone: 'danger' });
    }
  };

  const allOff = Object.entries(me.notificationPrefs).every(([k, v]) => k === 'reminder' || !v);

  const logout = async (all = false) => {
    await api(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }).catch(() => undefined);
    // Al cerrar sesión no deben quedar datos del usuario en la caché del service worker.
    navigator.serviceWorker?.controller?.postMessage('CLEAR');
    window.location.assign('/entrar');
  };

  return (
    <>
      <header className="page-header">
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <Avatar name={me.displayName} size="lg" />
          <div>
            <h1>{me.displayName}</h1>
            <span className="muted small">{me.email}</span>
          </div>
        </div>
      </header>

      <Link href="/notificaciones" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Card className="page-header__row">
          <span className="row">
            <Icon name="bell" /> Notificaciones
          </span>
          <span className="muted small">{unread > 0 ? `${unread} sin leer` : 'Al día'}</span>
        </Card>
      </Link>

      <section className="section" aria-labelledby="perfil-datos">
        <h2 id="perfil-datos" className="section__title">
          Tus datos
        </h2>
        <Card className="stack">
          <Input
            label="Nombre"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== me.displayName && update({ displayName: name })}
          />
          <Select
            label="Zona horaria"
            hint="Decide a qué hora se cierra tu día"
            value={me.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
          >
            {[...new Set([me.timezone, ...ZONES])].map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Card>
      </section>

      <section className="section" aria-labelledby="perfil-avisos">
        <h2 id="perfil-avisos" className="section__title">
          Avisos
        </h2>
        <Card className="stack">
          {push === 'unsupported' ? (
            <p className="small muted">
              {isIosWithoutInstall()
                ? 'En iPhone, instala la app en tu pantalla de inicio para recibir recordatorios.'
                : 'Este navegador no admite notificaciones push.'}
            </p>
          ) : (
            <Button
              variant={push === 'on' ? 'secondary' : 'primary'}
              block
              onClick={async () => {
                if (push === 'on') {
                  await disablePush();
                  setPush('off');
                } else {
                  const r = await enablePush().catch(() => 'denied' as const);
                  setPush(r === 'granted' ? 'on' : 'off');
                  if (r === 'denied') show({ message: 'Permiso denegado en el navegador' });
                }
              }}
            >
              {push === 'on'
                ? 'Desactivar notificaciones en este dispositivo'
                : 'Activar notificaciones en este dispositivo'}
            </Button>
          )}
          <div className="row">
            <Input
              label="Silencio desde"
              type="time"
              value={me.quietStart}
              onChange={(e) => e.target.value && update({ quietStart: e.target.value })}
            />
            <Input
              label="Hasta"
              type="time"
              value={me.quietEnd}
              onChange={(e) => e.target.value && update({ quietEnd: e.target.value })}
            />
          </div>
          <div className="toggle-list">
            {(Object.keys(PREF_LABELS) as NotificationType[]).map((k) => (
              <Checkbox
                key={k}
                label={PREF_LABELS[k]}
                checked={me.notificationPrefs[k]}
                onChange={(e) => update({ notificationPrefs: { [k]: e.target.checked } })}
              />
            ))}
          </div>
          {!allOff && (
            <Button
              variant="ghost"
              onClick={() =>
                update({
                  notificationPrefs: Object.fromEntries(
                    (Object.keys(PREF_LABELS) as NotificationType[]).map((k) => [
                      k,
                      k === 'reminder',
                    ]),
                  ),
                })
              }
            >
              Apagar todo menos los recordatorios
            </Button>
          )}
        </Card>
      </section>

      <section className="section" aria-labelledby="perfil-apariencia">
        <h2 id="perfil-apariencia" className="section__title">
          Apariencia
        </h2>
        <Card className="stack">
          <Select
            label="Tema"
            value={theme}
            onChange={(e) => {
              const v = e.target.value;
              setTheme(v);
              if (v === 'system') delete document.documentElement.dataset.theme;
              else document.documentElement.dataset.theme = v;
              setCookie('hb_theme', v === 'system' ? null : v);
            }}
          >
            <option value="system">Como el sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </Select>
          <Checkbox
            label="Modo calma"
            description="Menos color y movimiento."
            checked={me.calmMode}
            onChange={(e) => {
              const on = e.target.checked;
              if (on) document.documentElement.dataset.mode = 'calm';
              else delete document.documentElement.dataset.mode;
              setCookie('hb_mode', on ? 'calm' : null);
              void update({ calmMode: on });
            }}
          />
        </Card>
      </section>

      <div className="stack">
        <Button
          variant="secondary"
          block
          icon={<Icon name="logout" size={20} />}
          onClick={() => logout()}
        >
          Cerrar sesión
        </Button>
        <Button variant="danger" block onClick={() => logout(true)}>
          Cerrar sesión en todos los dispositivos
        </Button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          Esta app no reemplaza ayuda profesional. Si un hábito te supera, busca apoyo profesional o
          una línea de ayuda de tu país.
        </p>
      </div>
    </>
  );
}
