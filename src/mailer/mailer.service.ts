import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');

    if (!emailHost || !emailUser || !emailPassword || !emailFrom) {
      this.logger.warn(
        'Email configuration incomplete. Email sending will be disabled. ' +
          'Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, and EMAIL_FROM to enable emails.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.logger.log(`Mailer initialized with host: ${emailHost}`);
  }

  async sendVerificationEmail(email: string, name: string, token: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Verification email not sent to ${email}`,
      );
      return;
    }

    const verificationUrl = `${this.configService.get<string>('APP_URL', 'http://localhost:3000')}/api/auth/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Container Management System!</h2>
            <p>Hi ${name},</p>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">
              ${verificationUrl}
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 24 hours.
            </p>
          </div>
        `,
      });

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Password reset email not sent to ${email}`,
      );
      return;
    }

    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #2196F3; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">
              ${resetUrl}
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </p>
          </div>
        `,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Welcome email not sent to ${email}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Welcome to Container Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome Aboard! 🎉</h2>
            <p>Hi ${name},</p>
            <p>Your email has been verified successfully. You can now access all features of the Container Management System.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p style="margin-top: 30px;">Best regards,<br>Container Management Team</p>
          </div>
        `,
      });

      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}`, error);
    }
  }

  async sendCustomerLoginCode(email: string, name: string, code: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Login code not sent to ${email}. Code: ${code}`,
      );
      // In development, log the code so it can be used for testing
      this.logger.log(`LOGIN CODE for ${email}: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Your Login Code - Container Management',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Your Login Code</h2>
            <p>Hi ${name},</p>
            <p>You requested to login to your account. Use the code below to complete your login:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background-color: #f5f5f5; border: 2px dashed #4CAF50; 
                          padding: 20px; border-radius: 10px; display: inline-block;">
                <h1 style="margin: 0; font-size: 36px; letter-spacing: 8px; color: #4CAF50;">
                  ${code}
                </h1>
              </div>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              If you didn't request this code, please ignore this email.
            </p>
            <p style="margin-top: 30px;">Best regards,<br>Container Management Team</p>
          </div>
        `,
      });

      this.logger.log(`Login code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send login code to ${email}`, error);
      // Still log the code in case of email failure
      this.logger.log(`LOGIN CODE for ${email}: ${code}`);
      throw error;
    }
  }
}
