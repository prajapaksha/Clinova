import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { PatientsModule } from '../patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { EncountersModule } from '../encounters/encounters.module';
import { ReportingModule } from '../reporting/reporting.module';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../events/domain-event-bus';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/file-storage';
import { PortalModule } from '../portal/portal.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuditModule,
    StorageModule,
    StaffModule,
    AuthModule,
    PatientsModule,
    AppointmentsModule,
    EncountersModule,
    ReportingModule,
    BillingModule,
    PortalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: authenticate first, then authorize against the permission matrix.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
