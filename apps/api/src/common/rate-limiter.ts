import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * Ventana deslizante en memoria. Para varias instancias de la API habría
 * que mover el contador a Postgres; con una sola basta esto.
 */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper = setInterval(() => this.sweep(), 60_000).unref();

  /** Registra un intento; devuelve 0 si se permite o los ms que faltan para reintentar. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): number {
    const from = now - windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= limit) {
      this.hits.set(key, list);
      return (list[0] ?? now) + windowMs - now;
    }
    list.push(now);
    this.hits.set(key, list);
    return 0;
  }

  reset() {
    this.hits.clear();
  }

  private sweep(now = Date.now()) {
    for (const [key, list] of this.hits) {
      if ((list[list.length - 1] ?? 0) < now - 3_600_000) this.hits.delete(key);
    }
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }
}
