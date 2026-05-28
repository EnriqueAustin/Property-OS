import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTH_UNAUTHORIZED',
  403: 'AUTH_FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

const MESSAGE_CODE_MAP: Record<string, string> = {
  'Invalid credentials': 'AUTH_INVALID_CREDENTIALS',
  'Email already registered': 'AUTH_EMAIL_EXISTS',
  'Invalid or expired reset token': 'AUTH_RESET_TOKEN_INVALID',
  'Invalid refresh token': 'AUTH_REFRESH_INVALID',
  'No available room': 'BOOK_NO_AVAILABILITY',
  'Booking not found': 'BOOK_NOT_FOUND',
  'Guest not found': 'BOOK_GUEST_NOT_FOUND',
  'Property not found': 'PROP_NOT_FOUND',
  'Room type not found': 'INV_ROOM_TYPE_NOT_FOUND',
  'PayFast is not configured': 'PAY_PAYFAST_NOT_CONFIGURED',
  'Payment not found': 'PAY_NOT_FOUND',
  'Booking has no outstanding balance': 'PAY_NO_BALANCE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as any;
        message = b.message || message;
        if (Array.isArray(b.message)) {
          details = b.message;
          message = 'Validation failed';
        }
      }
    }

    const code =
      (typeof message === 'string' && MESSAGE_CODE_MAP[message]) ||
      STATUS_CODE_MAP[status] ||
      'UNKNOWN_ERROR';

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    });
  }
}
