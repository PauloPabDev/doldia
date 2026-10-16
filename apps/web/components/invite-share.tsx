'use client';

import { Button, Icon, useToast } from '@habitos/ui';

/** Invitación en un toque: hoja de compartir nativa, WhatsApp o copiar enlace. */
export function InviteShare({ code, pactName }: { code: string; pactName: string }) {
  const { show } = useToast();
  const url =
    typeof window === 'undefined' ? `/unirse/${code}` : `${window.location.origin}/unirse/${code}`;
  const text = `Únete a mi pacto "${pactName}" para sostener hábitos juntos`;

  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <Button
        icon={<Icon name="share" size={20} />}
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ title: pactName, text, url }).catch(() => undefined);
          } else {
            await navigator.clipboard.writeText(url);
            show({ message: 'Enlace copiado' });
          }
        }}
      >
        Invitar
      </Button>
      <a
        className="hb-button hb-button--secondary hb-button--md"
        href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <Button
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          show({ message: 'Enlace copiado' });
        }}
      >
        Copiar enlace
      </Button>
    </div>
  );
}
