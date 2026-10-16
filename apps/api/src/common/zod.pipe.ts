import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Valida con el esquema de contracts; lo que no está en el esquema se descarta. */
export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        code: 'validation_error',
        message: result.error.issues[0]?.message ?? 'Datos inválidos',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data as ReturnType<T['parse']>;
  }
}
