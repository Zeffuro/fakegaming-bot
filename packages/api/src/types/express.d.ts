import { Request } from 'express';

export interface AuthUser {
  discordId: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
