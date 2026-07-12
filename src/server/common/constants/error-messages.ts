import { ErrorCodes } from './error-codes';

export const ErrorMessages: Record<ErrorCodes, string> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]:
    'That email or password is not correct. Please try again.',
  [ErrorCodes.AUTH_UNAUTHORIZED]: 'You need to sign in again to continue.',
  [ErrorCodes.AUTH_REFRESH_TOKEN_INVALID]: 'Your session is no longer valid. Please sign in again.',
  [ErrorCodes.AUTH_REFRESH_TOKEN_MISSING]: 'Your session is missing. Please sign in again.',
  [ErrorCodes.AUTH_REFRESH_TOKEN_REVOKED]: 'You have been signed out. Please sign in again.',
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]:
    'Please confirm your email address before signing in. Check your inbox, or request a new verification link.',
  [ErrorCodes.AUTH_INVALID_OR_EXPIRED_TOKEN]:
    'This link is invalid or has expired. Request a new verification or password reset email.',
  [ErrorCodes.AUTH_EMAIL_NOT_CONFIGURED]:
    'The server cannot send email yet. Ask the administrator to configure transactional email (e.g. Resend).',
  [ErrorCodes.AUTH_EMAIL_SEND_FAILED]:
    'We could not send the email. Please try again in a few minutes or contact support.',
  [ErrorCodes.AUTH_ADMIN_REGISTER_DISABLED]: 'Creating an admin account this way is not enabled.',
  [ErrorCodes.AUTH_ADMIN_INVITE_INVALID]: 'The admin invite code is not valid.',

  [ErrorCodes.USER_NOT_FOUND]: 'No account was found for that information.',
  [ErrorCodes.USER_ALREADY_EXISTS]:
    'An account with this email already exists. Try signing in or use “Forgot password”.',
  [ErrorCodes.USER_DELETE_BLOCKED]:
    'This user cannot be removed or changed that way (for example: last admin, leads they created, or your own account).',

  [ErrorCodes.ACCESS_DENIED]: 'You do not have permission to do that.',

  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'Something went wrong on our side. Please try again shortly.',

  [ErrorCodes.DATABASE_NOT_CONFIGURED]:
    'The API cannot reach the database. Set DATABASE_URL in .env.local to your Supabase transaction pooler URI (port 6543).',

  [ErrorCodes.DATABASE_UNAVAILABLE]:
    'The database is temporarily unavailable. Check DATABASE_URL in .env.local (Supabase pooler :6543), then open /api/health/db. If you see max clients errors, stop extra local servers and retry.',

  [ErrorCodes.VALIDATION_FAILED]: 'Some of the information you entered is not valid. Please check and try again.',

  [ErrorCodes.PRODUCT_NOT_FOUND]: 'That product could not be found.',
  [ErrorCodes.ORDER_NOT_FOUND]: 'That order could not be found.',
  [ErrorCodes.CONSULTATION_NOT_FOUND]: 'That consultation request could not be found.',
  [ErrorCodes.CONTACT_MESSAGE_NOT_FOUND]: 'That contact message could not be found.',
  [ErrorCodes.LEAD_NOT_FOUND]: 'That lead could not be found.',
  [ErrorCodes.BLOG_NOT_FOUND]: 'That blog post could not be found.',
};
