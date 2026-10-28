import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PatientRoute } from '../auth/decorators/patient-route.decorator';
import { AuditCtx } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.service';
import { PortalAuthService } from './portal-auth.service';
import {
  ForgotPasswordDto,
  PortalActivateDto,
  PortalChangePasswordDto,
  PortalLoginDto,
  PortalRegisterDto,
  ResetPasswordDto,
} from './dto/portal.dto';

@ApiTags('portal-auth')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly auth: PortalAuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patient sign-in (locks after 5 failed attempts)' })
  login(@Body() dto: PortalLoginDto, @AuditCtx() ctx: AuditContext) {
    return this.auth.login(dto.email, dto.password, ctx);
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Create an account for an existing patient (last name + DOB + email on file must match)' })
  register(@Body() dto: PortalRegisterDto, @AuditCtx() ctx: AuditContext) {
    return this.auth.register(dto, ctx);
  }

  @Post('activate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an invited account with the code from the practice' })
  activate(@Body() dto: PortalActivateDto, @AuditCtx() ctx: AuditContext) {
    return this.auth.activate(dto, ctx);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() dto: ForgotPasswordDto, @AuditCtx() ctx: AuditContext) {
    return this.auth.forgotPassword(dto.email, ctx);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @AuditCtx() ctx: AuditContext) {
    return this.auth.resetPassword(dto.token, dto.password, ctx);
  }

  @Get('me')
  @PatientRoute()
  me(@Req() req: { user: AuthUser }) {
    return this.auth.me(req.user.id);
  }

  @Post('change-password')
  @PatientRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@Body() dto: PortalChangePasswordDto, @Req() req: { user: AuthUser }, @AuditCtx() ctx: AuditContext) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword, ctx);
  }

  @Post('logout')
  @PatientRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@AuditCtx() ctx: AuditContext) {
    return this.auth.logout(ctx);
  }
}
