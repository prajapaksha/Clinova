import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PatientsModule } from '../patients/patients.module';
import { PortalAuthController } from './portal-auth.controller';
import { PortalController } from './portal.controller';
import { CareTeamController } from './care-team.controller';
import { PortalAuthService } from './portal-auth.service';
import { PortalSchedulingService } from './portal-scheduling.service';
import { PortalRecordsService } from './portal-records.service';
import { PortalBillingService, SimulatedPaymentGateway } from './portal-billing.service';
import { MessagingService } from './messaging.service';
import { PortalRequestsService } from './portal-requests.service';

/** Patient portal bounded context (PRD §4.8) and its staff-facing counterparts. */
@Module({
  imports: [AuthModule, BillingModule, PatientsModule],
  controllers: [PortalAuthController, PortalController, CareTeamController],
  providers: [
    PortalAuthService,
    PortalSchedulingService,
    PortalRecordsService,
    PortalBillingService,
    SimulatedPaymentGateway,
    MessagingService,
    PortalRequestsService,
  ],
})
export class PortalModule {}