import './load-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { initFirebase } from '@sfcc/firebase';
import { AppModule } from './app.module';

function resolveCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS ?? process.env.WEB_ORIGIN ?? '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length > 0) return origins;
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}

export async function startApi(): Promise<void> {
  initFirebase();
  // Preserve the exact bytes needed for provider webhook HMAC verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const trustedProxies = (process.env.TRUST_PROXY ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (trustedProxies.length > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxies);
  }

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== 'false');
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Salesforce DevOps Command Center API')
      .setDescription('AI-powered Salesforce development lifecycle automation')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, process.env.API_HOST ?? '0.0.0.0');
  const workerId = process.env.CLUSTER_WORKER_ID;
  const prefix = workerId ? `[worker ${workerId}] ` : '';
  console.log(`${prefix}API running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`${prefix}Swagger docs at http://localhost:${port}/api/docs`);
  }
}
