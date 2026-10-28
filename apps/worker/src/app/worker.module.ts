import { Module } from '@nestjs/common';
import { PrismaModule } from '@clinova/api/shared';
import { NotificationsModule } from '@clinova/api/notifications';
import { NotificationWorker } from './notification-worker';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [NotificationWorker],
})
export class WorkerModule {}