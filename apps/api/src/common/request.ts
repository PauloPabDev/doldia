import type { Request } from 'express';

export interface AuthUser {
  id: string;
  sessionId: string;
}

export interface AppRequest extends Request {
  user?: AuthUser;
  cookies: Record<string, string>;
}
