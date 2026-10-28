import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './app/worker.module';

/** Background job processor (PRD §12.2): delivers the notification outbox and runs schedules. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'warn', 'error', 'fatal'] });
  app.enableShutdownHooks();
  Logger.log('Clinova worker started', 'Worker');
}

bootstrap();