import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';

export class DashboardQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @Type(() => Number) @IsInt() @Min(-840) @Max(840)
  tzOffset!: number;

  @IsOptional() @IsString()
  providerId?: string;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: "Today's KPIs, roster, alerts, and weekly volume for the staff home page" })
  getSummary(@Query() query: DashboardQueryDto, @Request() req: { user: AuthUser }) {
    return this.dashboard.getSummary(query, req.user);
  }
}
