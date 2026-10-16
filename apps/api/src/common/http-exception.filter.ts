import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  429: 'too_many_requests',
};

/** Respuestas de error uniformes y sin trazas internas en producción. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  constructor(private readonly exposeInternal: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const obj =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      const message =
        typeof obj.message === 'string'
          ? obj.message
          : typeof body === 'string'
            ? body
            : exception.message;
      res.status(status).json({
        error: {
          code: typeof obj.code === 'string' ? obj.code : (DEFAULT_CODES[status] ?? 'error'),
          message,
          ...(obj.details !== undefined ? { details: obj.details } : {}),
        },
      });
      return;
    }

    // body-parser lanza errores con status (JSON mal formado, cuerpo muy grande).
    const status = (exception as { status?: number })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({
        error: { code: DEFAULT_CODES[status] ?? 'bad_request', message: 'Petición inválida' },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'internal_error',
        message: 'Algo salió mal. Inténtalo de nuevo.',
        ...(this.exposeInternal && exception instanceof Error
          ? { details: exception.message }
          : {}),
      },
    });
  }
}
