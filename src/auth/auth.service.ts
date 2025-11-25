import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../user/users.service';
import { CustomersService } from '../customers/customers.service';
import { MailerService } from '../mailer/mailer.service';
import { PasswordResetRequestedEvent } from '../events/user.events';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly customersService: CustomersService,
    private readonly mailerService: MailerService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async validateUser(email: string, password: string, organization: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Check if organization matches
    if (user.organization !== organization) {
      throw new UnauthorizedException(
        'Invalid credentials or wrong organization selected',
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    // Email verification check disabled - all users auto-verified
    // if (!user.emailVerified) {
    //   throw new UnauthorizedException(
    //     'Please verify your email address before logging in. Check your inbox for the verification link.',
    //   );
    // }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const { passwordHash, refreshTokenHash, ...safe } = user.toObject();
    return { ...safe, id: user.id };
  }

  async issueTokens(
    userId: string,
    role: string,
    organization: string,
    warehouseId?: string | null,
  ) {
    const payload = {
      sub: userId,
      role,
      organization,
      warehouseId: warehouseId ?? null,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '1d',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);
    await this.usersService.setRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, organization: string) {
    const user = await this.validateUser(email, password, organization);
    const tokens = await this.issueTokens(
      user.id,
      user.role,
      user.organization,
      user.warehouseId,
    );
    return { user, ...tokens };
  }

  async refresh(
    userId: string,
    role: string,
    organization: string,
    warehouseId: string | null,
    token: string,
  ) {
    const valid = await this.usersService.verifyRefreshToken(userId, token);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');
    return this.issueTokens(userId, role, organization, warehouseId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists or not
      return;
    }

    const resetToken = await this.usersService.generatePasswordResetToken(
      email.toLowerCase(),
    );
    if (resetToken) {
      this.eventEmitter.emit(
        'password.reset.requested',
        new PasswordResetRequestedEvent(user.email, user.name, resetToken),
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    return this.usersService.resetPassword(token, newPassword);
  }

  async verifyEmail(token: string): Promise<boolean> {
    return this.usersService.verifyEmail(token);
  }
}
