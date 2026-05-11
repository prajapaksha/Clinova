import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from './decorators/public.decorator';
import type { AuthUser } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Request() req: { user: AuthUser }) {
    return this.auth.login(req.user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@Request() req: { user: AuthUser }) {
    return req.user;
  }
}
