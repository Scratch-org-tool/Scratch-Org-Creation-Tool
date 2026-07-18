import './load-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
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

function resolveTrustProxy(): boolean | number | string | string[] | undefined {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return values.length === 1 ? values[0] : values;
}

export async function startApi(): Promise<void> {
  initFirebase();
  // Preserve the exact bytes needed for provider webhook HMAC verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const trustedProxies = resolveTrustProxy();
  if (trustedProxies !== undefined) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxies);
  }

  // Standard hardening headers (nosniff, HSTS, frame denial, …). The CSP is
  // owned by the web app's middleware — the API serves JSON plus Swagger UI,
  // which helmet's default CSP would break.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

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
