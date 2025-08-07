/**
 * Express type extensions for DwayBank
 * Extends Express Request interface with custom properties
 */

import { UserProfile } from './index';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: UserProfile;
      session?: {
        id: string;
        user_id: string;
        ip_address: string;
        user_agent: string;
        token_family: string;
        status: string;
        expires_at: Date;
        created_at: Date;
        last_activity: Date;
      };
    }
  }
}

export interface AuthenticatedRequest extends Express.Request {
  requestId?: string;
  user?: UserProfile;
  session?: {
    id: string;
    user_id: string;
    ip_address: string;
    user_agent: string;
    token_family: string;
    status: string;
    expires_at: Date;
    created_at: Date;
    last_activity: Date;
  };
}