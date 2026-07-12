import type { ErrorCodes } from '../common/constants/error-codes';
import { ErrorMessages } from '../common/constants/error-messages';
import type { HttpStatusCode } from '../common/constants/http-status';
import type { SuccessCodes } from '../common/constants/success-messages';
import { SuccessMessages } from '../common/constants/success-messages';

export interface SuccessResponse<T> {
  success: true;
  code?: SuccessCodes;
  message?: string;
  data: T;
}

export interface ErrorResponse {
  success: false;
  code: ErrorCodes;
  message: string;
  statusCode: HttpStatusCode;
}

export const buildSuccessResponse = <T>(
  data: T,
  successCode?: SuccessCodes,
): SuccessResponse<T> => {
  const message = successCode ? SuccessMessages[successCode] : undefined;

  return {
    success: true,
    code: successCode,
    message,
    data,
  };
};

export const buildErrorResponse = (
  errorCode: ErrorCodes,
  statusCode: HttpStatusCode,
  rawMessage?: string,
): ErrorResponse => {
  const defaultMessage = ErrorMessages[errorCode];
  /** AppError defaults `Error.message` to the code string; never let that override the catalog text. */
  const trimmed = rawMessage?.trim() ?? '';
  const useRaw =
    trimmed.length > 0 && trimmed !== errorCode && trimmed !== defaultMessage;

  return {
    success: false,
    code: errorCode,
    message: useRaw ? trimmed : defaultMessage,
    statusCode,
  };
};
