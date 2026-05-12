import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'fatal'],
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Global validation pipe — strip unknown props, transform payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS — tighten origins in production via env
  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:4400', 'http://localhost:4401'],
    credentials: true,
  });

  // OpenAPI docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Clinova API')
    .setDescription('Clinova Health Platform REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/${globalPrefix}`);
  Logger.log(`Swagger docs at http://localhost:${port}/${globalPrefix}/docs`);
}

bootstrap();
