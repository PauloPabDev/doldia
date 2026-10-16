export interface GardenProps {
  /** 0 a 1: registros del grupo en la semana frente al total posible. */
  growth: number;
  members: number;
}

/** Jardín del pacto: cada registro del grupo hace crecer una planta; con la semana completa, florece. */
export function Garden({ growth, members }: GardenProps) {
  const g = Math.max(0, Math.min(1, growth));
  const plants = Math.max(3, Math.min(8, members));
  const bloom = g >= 0.999;
  const pct = Math.round(g * 100);
  return (
    <figure className="hb-garden" data-bloom={bloom || undefined}>
      <svg
        viewBox="0 0 320 120"
        role="img"
        aria-label={
          bloom ? 'El jardín del pacto floreció' : `El jardín del pacto creció ${pct} % esta semana`
        }
      >
        <rect className="hb-garden__ground" x="0" y="96" width="320" height="24" rx="12" />
        {Array.from({ length: plants }, (_, i) => {
          const x = 24 + (i * 272) / (plants - 1);
          // Cada planta tiene su propio umbral para que crezcan escalonadas.
          const local = Math.max(0, Math.min(1, g * plants - i * 0.6));
          const h = 8 + local * 64;
          return (
            <g
              key={i}
              className="hb-garden__plant"
              style={{ '--h': `${h}px` } as React.CSSProperties}
            >
              <path d={`M${x} 98 V${98 - h}`} className="hb-garden__stem" />
              {local > 0.3 && (
                <ellipse
                  cx={x - 7}
                  cy={98 - h * 0.55}
                  rx="7"
                  ry="4"
                  className="hb-garden__leaf"
                  transform={`rotate(-30 ${x - 7} ${98 - h * 0.55})`}
                />
              )}
              {local > 0.6 && (
                <ellipse
                  cx={x + 7}
                  cy={98 - h * 0.75}
                  rx="7"
                  ry="4"
                  className="hb-garden__leaf"
                  transform={`rotate(30 ${x + 7} ${98 - h * 0.75})`}
                />
              )}
              {bloom && <circle cx={x} cy={98 - h - 4} r="6" className="hb-garden__flower" />}
            </g>
          );
        })}
      </svg>
      <figcaption className="hb-garden__caption">
        {bloom ? '¡El jardín floreció! 🌸' : `${pct} % de la semana`}
      </figcaption>
    </figure>
  );
}
