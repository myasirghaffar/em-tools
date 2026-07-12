export enum SuccessCodes {
  AUTH_REGISTER_SUCCESS = 'AUTH_REGISTER_SUCCESS',
  AUTH_REGISTER_PENDING_VERIFICATION = 'AUTH_REGISTER_PENDING_VERIFICATION',
  AUTH_VERIFY_EMAIL_SUCCESS = 'AUTH_VERIFY_EMAIL_SUCCESS',
  AUTH_RESEND_VERIFICATION_SUCCESS = 'AUTH_RESEND_VERIFICATION_SUCCESS',
  AUTH_FORGOT_PASSWORD_SUCCESS = 'AUTH_FORGOT_PASSWORD_SUCCESS',
  AUTH_RESET_PASSWORD_SUCCESS = 'AUTH_RESET_PASSWORD_SUCCESS',
  AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGOUT_SUCCESS = 'AUTH_LOGOUT_SUCCESS',
  AUTH_REFRESH_SUCCESS = 'AUTH_REFRESH_SUCCESS',
  USER_ME_SUCCESS = 'USER_ME_SUCCESS',
}

export const SuccessMessages: Record<SuccessCodes, string> = {
  [SuccessCodes.AUTH_REGISTER_SUCCESS]: 'User registered successfully',
  [SuccessCodes.AUTH_REGISTER_PENDING_VERIFICATION]:
    'Check your email to verify your account before signing in',
  [SuccessCodes.AUTH_VERIFY_EMAIL_SUCCESS]: 'Email verified — you are signed in',
  [SuccessCodes.AUTH_RESEND_VERIFICATION_SUCCESS]: 'If an account exists, a verification email was sent',
  [SuccessCodes.AUTH_FORGOT_PASSWORD_SUCCESS]:
    'If an account exists for this email, password reset instructions were sent',
  [SuccessCodes.AUTH_RESET_PASSWORD_SUCCESS]: 'Password updated — you can sign in now',
  [SuccessCodes.AUTH_LOGIN_SUCCESS]: 'Login successful',
  [SuccessCodes.AUTH_LOGOUT_SUCCESS]: 'Logout successful',
  [SuccessCodes.AUTH_REFRESH_SUCCESS]: 'Token refreshed successfully',
  [SuccessCodes.USER_ME_SUCCESS]: 'Profile loaded',
};

