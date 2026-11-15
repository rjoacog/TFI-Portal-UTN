export { clearSessionCookie, SESSION_COOKIE_NAME, setSessionCookie } from './cookie.js';
export {
  allowPasswordChangePending,
  createOriginCheck,
  createRequireAuth,
  requireRole,
} from './middleware.js';
export type { AuthUser } from './middleware.js';
export { assertTeachingAssignment } from './teaching.js';
export { SESSION_TTL_SECONDS, signToken, verifyToken } from './token.js';
export type { TokenPayload } from './token.js';
