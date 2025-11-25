import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './user/users.service';
import { UserRole, Organization } from './user/users.schema';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      // Check for multiple admins JSON configuration first
      const adminsJson = this.configService.get<string>('BOOTSTRAP_ADMINS');
      
      if (adminsJson) {
        await this.createMultipleAdmins(adminsJson);
      } else {
        // Fallback to single admin creation (backward compatibility)
        await this.createSingleAdmin();
      }
    } catch (err) {
      this.logger.error('Bootstrap failed', err as any);
    }
  }

  private async createMultipleAdmins(adminsJson: string) {
    try {
      const admins = JSON.parse(adminsJson);
      
      if (!Array.isArray(admins)) {
        this.logger.error('BOOTSTRAP_ADMINS must be a JSON array');
        return;
      }

      this.logger.log(`Bootstrapping ${admins.length} admin user(s)...`);

      for (const adminConfig of admins) {
        await this.createAdmin(
          adminConfig.email,
          adminConfig.password,
          adminConfig.name,
          adminConfig.organization || 'skyline',
        );
      }
    } catch (err) {
      this.logger.error('Failed to parse BOOTSTRAP_ADMINS JSON', err as any);
    }
  }

  private async createSingleAdmin() {
    // Only create admin user if environment variables are explicitly set
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    const adminName = this.configService.get<string>('ADMIN_NAME');
    const adminOrg =
      this.configService.get<string>('ADMIN_ORGANIZATION') || 'skyline';

    if (!adminEmail || !adminPassword || !adminName) {
      this.logger.warn(
        'Admin credentials not configured. Skipping admin user creation. ' +
          'Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, and optionally ADMIN_ORGANIZATION (skyline|skyrak) to create initial admin. ' +
          'Or use BOOTSTRAP_ADMINS JSON array for multiple admins.',
      );
      return;
    }

    await this.createAdmin(adminEmail, adminPassword, adminName, adminOrg);
  }

  private async createAdmin(
    email: string,
    password: string,
    name: string,
    organization: string,
  ) {
    // Validate organization
    if (organization !== 'skyline' && organization !== 'skyrak') {
      this.logger.error(
        `Organization must be either "skyline" or "skyrak" for ${email}. Defaulting to skyline.`,
      );
      organization = 'skyline';
    }

    // Validate password strength
    if (password.length < 12) {
      this.logger.error(
        `Password must be at least 12 characters long for ${email}. Skipping admin creation.`,
      );
      return;
    }

    const existing = await this.usersService.findByEmail(email);
    if (!existing) {
      const admin = await this.usersService.createStaff({
        name: name,
        email: email,
        password: password,
        role: UserRole.ADMIN,
        organization:
          organization === 'skyrak' ? Organization.SKYRAK : Organization.SKYLINE,
      });

      // Auto-verify admin email
      admin.emailVerified = true;
      admin.emailVerificationToken = null;
      admin.emailVerificationExpires = null;
      await admin.save();

      this.logger.log(
        `✓ Created admin user: ${email} for ${organization} organization (email auto-verified)`,
      );
    } else {
      this.logger.log(`→ Admin user already exists: ${email}`);
    }
  }
}
