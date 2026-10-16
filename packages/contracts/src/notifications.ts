import { z } from 'zod';
import { notificationType } from './auth';
import { id } from './common';

export const notification = z.object({
  id,
  type: notificationType,
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof notification>;

export const notificationsResponse = z.object({
  items: z.array(notification),
  unread: z.number().int(),
});
export type NotificationsResponse = z.infer<typeof notificationsResponse>;

export const markReadInput = z.object({ ids: z.array(id).max(100).optional() });

export const pushSubscribeInput = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type PushSubscribeInput = z.input<typeof pushSubscribeInput>;

export const pushUnsubscribeInput = z.object({ endpoint: z.string().max(1000) });

export const vapidKeyResponse = z.object({ publicKey: z.string() });
