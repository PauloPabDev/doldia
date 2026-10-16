import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super({ code, message, details }, status);
  }
}

export const notFound = (what = 'Recurso') =>
  new AppError(HttpStatus.NOT_FOUND, 'not_found', `${what} no encontrado`);
export const forbidden = (message = 'No tienes acceso a este recurso') =>
  new AppError(HttpStatus.FORBIDDEN, 'forbidden', message);
export const conflict = (code: string, message: string) =>
  new AppError(HttpStatus.CONFLICT, code, message);
export const unauthorized = (message = 'Inicia sesión para continuar') =>
  new AppError(HttpStatus.UNAUTHORIZED, 'unauthorized', message);
export const badRequest = (code: string, message: string) =>
  new AppError(HttpStatus.BAD_REQUEST, code, message);
