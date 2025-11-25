import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '../mailer/mailer.service';
import {
  UserRegisteredEvent,
  PasswordResetRequestedEvent,
  EmailVerifiedEvent,
} from './user.events';

@Injectable()
export class EmailListener {
  private readonly logger = new Logger(EmailListener.name);

  constructor(private readonly mailerService: MailerService) {}

  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`Handling user.registered event for ${event.email}`);
    try {
      await this.mailerService.sendVerificationEmail(
        event.email,
        event.name,
        event.verificationToken,
      );
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
    }
  }

  @OnEvent('password.reset.requested')
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    this.logger.log(
      `Handling password.reset.requested event for ${event.email}`,
    );
    try {
      await this.mailerService.sendPasswordResetEmail(
        event.email,
        event.name,
        event.resetToken,
      );
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
    }
  }

  @OnEvent('email.verified')
  async handleEmailVerified(event: EmailVerifiedEvent) {
    this.logger.log(`Handling email.verified event for ${event.email}`);
    try {
      await this.mailerService.sendWelcomeEmail(event.email, event.name);
    } catch (error) {
      this.logger.error('Failed to send welcome email', error);
    }
  }
}


