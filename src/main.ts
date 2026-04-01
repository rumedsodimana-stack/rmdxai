import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const nodeEnv = config.get('NODE_ENV', 'development');

  // ── Global validation ────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform primitives (e.g. string '1' → number)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: nodeEnv === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── API prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Swagger ──────────────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Singularity PMS API')
      .setDescription(
        'Multi-tenant Hotel Property Management System — REST API.\n\n' +
        '**Authentication:** All protected routes require a Bearer JWT token.\n' +
        'Obtain tokens via `POST /api/v1/auth/login`. Pass `propertyId` in the request body.\n\n' +
        '**Multi-tenancy:** All data is scoped to the `propertyId` embedded in the JWT.\n\n' +
        '**RBAC Roles:** `ADMIN > GM > DEPT_MANAGER > SUPERVISOR > STAFF | FINANCE | GUEST`\n\n' +
        '**Hard AI Limits (never automated):**\n' +
        '- Walking a guest to a room\n' +
        '- Issuing a key without ID verification\n' +
        '- Charging a card without explicit consent\n' +
        '- Modifying an audit trail\n' +
        '- Initiating emergency services\n' +
        '- Blacklisting a guest',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & authorisation')
      .addTag('pms', 'Property Management — rooms, reservations, folios, night audit')
      .addTag('pos', 'Point of Sale — outlets, menu, orders, billing')
      .addTag('channel', 'Channel Manager — rate plans, OTA sync')
      .addTag('rms', 'Revenue Management — pricing rules, forecasts, KPIs')
      .addTag('crm', 'Guest Relationship Management — profiles, loyalty, VIP')
      .addTag('finance', 'Finance — journal entries, invoices, audit log')
      .addTag('hcm', 'Human Capital Management — staff, shifts, payroll')
      .addTag('procurement', 'Procurement — suppliers, inventory, purchase orders')
      .addTag('bms', 'Building Management — assets, maintenance, work orders')
      .addTag('security', 'Security — access logs, incidents, key cards')
      .addTag('analytics', 'Analytics — KPI snapshots, reports, exports')
      .addTag('guest-app', 'Guest App — self check-in, service requests, feedback')
      .addTag('comms', 'Internal Communications — messages, announcements')
      .addTag('os-kernel', 'OS Kernel — event bus, automation tasks, AI limits')
      .addTag('multi-property', 'Multi-Property — property groups, cross-property reporting')
      .addTag('events', 'Events — bookings, banquets, function sheets')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger UI available at http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`Singularity PMS running on http://localhost:${port}/api/v1`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Failed to start application', err);
  process.exit(1);
});
