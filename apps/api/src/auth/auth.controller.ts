import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './decorators/public.decorator';
import { AuditCtx } from '../audit/audited';
import type { AuditContext } from '../audit/audit.service';

class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(1) @MaxLength(200) newPassword!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password (locks after 5 failed attempts)' })
  login(@Request() req: { user: AuthUser }) {
    return this.auth.login(req.user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user, including password-expiry status' })
  async me(@Request() req: { user: AuthUser }) {
    const user = await this.auth.me(req.user.id);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change own password (min 12 chars, upper, lower, number, symbol)' })
  changePassword(@Body() dto: ChangePasswordDto, @Request() req: { user: AuthUser }, @AuditCtx() ctx: AuditContext) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword, ctx);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record sign-out in the audit log' })
  logout(@AuditCtx() ctx: AuditContext) {
    return this.auth.logout(ctx);
  }
}