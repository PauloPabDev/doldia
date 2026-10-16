import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { loadEnv } from './config';

export async function createApp(): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.NODE_ENV === 'test' ? ['error'] : ['log', 'warn', 'error'],
    bodyParser: false,
  });
  // Detrás de Caddy: confiar en un salto para leer la IP real del cliente.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '100kb' });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter(env.NODE_ENV !== 'production'));
  app.enableShutdownHooks();
  return app;
}
