import { Module } from '@nestjs/common';
import { PracticeSettings } from './practice-settings';
import { DeliveryProviders } from './delivery-providers';
import { NotificationTemplates } from './notification-templates';
import { NotificationOutbox } from './notification-outbox';
import { AppointmentNotices } from './appointment-notices';
import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationScheduler } from './notification-scheduler';
import { NotificationQueries } from './notification-queries';
import { NotificationEventHandlers } from './notification-event-handlers';

const CORE = [
  PracticeSettings,
  DeliveryProviders,
  NotificationTemplates,
  NotificationOutbox,
  AppointmentNotices,
  NotificationDispatcher,
  NotificationScheduler,
  NotificationQueries,
];

/** Notification services. Requires PrismaModule (global) from @clinova/api/shared. */
@Module({ providers: CORE, exports: CORE })
export class NotificationsModule {}

/** API process only: subscribes to domain events (requires EventsModule). */
@Module({ imports: [NotificationsModule], providers: [NotificationEventHandlers], exports: [NotificationsModule] })
export class NotificationEventsModule {}