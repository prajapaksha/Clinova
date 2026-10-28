import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { InvoicesService } from './invoices.service';
import { ClaimsService } from './claims.service';
import { FeeSchedulesService } from './fee-schedules.service';
import { BillingSummaryService } from './billing-summary.service';

@Module({
  controllers: [BillingController],
  providers: [InvoicesService, ClaimsService, FeeSchedulesService, BillingSummaryService],
  exports: [InvoicesService],
})
export class BillingModule {}
