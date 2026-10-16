import type { GainedReward, LogResponse, LogStatus } from '@habitos/contracts';
import { logResponse } from '@habitos/contracts';
import { api, NetworkError } from './api';
import { localToday } from './dates';
import { enqueue } from './offline-queue';

export type CheckInResult = { kind: 'synced'; response: LogResponse } | { kind: 'queued' };

/**
 * Registra un hábito. Sin red, el registro va a la cola offline con su
 * client_id y fecha local; la UI ya lo mostró hecho de forma optimista.
 */
export async function checkIn(
  habitId: string,
  status: LogStatus,
  tz: string,
  extra: { note?: string | null; value?: number | null } = {},
): Promise<CheckInResult> {
  const clientId = crypto.randomUUID();
  const localDate = localToday(tz);
  const body = {
    status,
    clientId,
    localDate,
    note: extra.note ?? null,
    value: extra.value ?? null,
  };
  try {
    const response = await api(`/habits/${habitId}/logs`, {
      method: 'POST',
      body,
      schema: logResponse,
    });
    return { kind: 'synced', response };
  } catch (err) {
    if (err instanceof NetworkError) {
      await enqueue({ ...body, habitId, queuedAt: Date.now() });
      return { kind: 'queued' };
    }
    throw err;
  }
}

export function rewardMessage(reward: GainedReward) {
  return reward.xp > 0 ? `+${reward.xp} XP` : undefined;
}
