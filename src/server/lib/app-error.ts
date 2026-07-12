import type { ErrorCodes } from '../common/constants/error-codes';
import type { HttpStatusCode } from '../common/constants/http-status';

export class AppError extends Error {
  constructor(
    public readonly errorCode: ErrorCodes,
    public readonly statusCode: HttpStatusCode,
    message?: string,
  ) {
    super(message ?? errorCode);
    this.name = 'AppError';
  }
}
