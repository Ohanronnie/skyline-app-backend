import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CustomersService } from '../customers/customers.service';
import { PartnersService } from '../partners/partners.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly customersService: CustomersService,
    private readonly partnersService: PartnersService,
  ) {}

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.organization);
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  async refresh(@Req() req: any) {
    const {
      userId,
      role,
      organization,
      warehouseId,
      isCustomer,
      isPartner,
      refreshToken,
    } = req.user;

    if (isPartner) {
      return this.partnersService.refresh(userId, refreshToken);
    }

    if (isCustomer) {
      return this.customersService.refresh(userId, refreshToken);
    }

    return this.authService.refresh(
      userId,
      role,
      organization,
      warehouseId,
      refreshToken,
    );
  }

  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message: 'If that email exists, a password reset link has been sent',
    };
  }

  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(
      dto.token,
      dto.password,
    );
    if (!success) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    return { message: 'Password reset successful' };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }
    const success = await this.authService.verifyEmail(token);
    if (!success) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    return { message: 'Email verified successfully. You can now login.' };
  }
}
