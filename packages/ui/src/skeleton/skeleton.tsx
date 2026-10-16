export interface SkeletonProps {
  lines?: number;
  height?: number;
}

/** Formas suaves con brillo lento en lugar de spinners. */
export function Skeleton({ lines = 3, height = 72 }: SkeletonProps) {
  return (
    <div className="hb-skeleton" role="status" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="hb-skeleton__block" style={{ blockSize: height }} />
      ))}
    </div>
  );
}
