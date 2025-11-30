import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './user/users.service';
import { UserRole, Organization } from './user/users.schema';
import { SmsTemplatesService } from './sms-templates/sms-templates.service';
import { ShipmentStatus } from './shipments/shipments.schema';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly smsTemplatesService: SmsTemplatesService,
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

      // Seed default SMS templates
      await this.seedDefaultSmsTemplates();
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
          organization === 'skyrak'
            ? Organization.SKYRAK
            : Organization.SKYLINE,
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

  private async seedDefaultSmsTemplates() {
    // First, remove all existing default templates to avoid index conflicts
    try {
      await this.smsTemplatesService.removeAllDefaultTemplates();
      this.logger.log('Cleared all existing default SMS templates');
    } catch (error: any) {
      this.logger.warn('Failed to clear existing templates:', error.message);
    }

    const organizations = [Organization.SKYLINE, Organization.SKYRAK];
    const defaultTemplates = [
      {
        name: 'goods_received_in_china',
        title: 'Goods Received in China',
        content:
          'Hello {{customerName}}, your goods have been received in China. Tracking: {{trackingNumber}}. {{companyName}}',
        statusMapping: [ShipmentStatus.RECEIVED, ShipmentStatus.RECEIVED_CHINA],
      },
      {
        name: 'shipped_from_china',
        title: 'Shipped from China',
        content:
          'Hello {{customerName}}, your goods have been shipped from China and are on their way. Tracking: {{trackingNumber}}. {{companyName}}',
        statusMapping: [ShipmentStatus.LOADED, ShipmentStatus.LOADED_CHINA],
      },
      {
        name: 'in_transit',
        title: 'In Transit',
        content:
          'Hello {{customerName}}, your goods are currently in transit. Tracking: {{trackingNumber}}. {{companyName}}',
        statusMapping: [ShipmentStatus.IN_TRANSIT],
      },
      {
        name: 'received_in_ghana',
        title: 'Received in Ghana',
        content:
          'Hello {{customerName}}, your goods have arrived in Ghana. Tracking: {{trackingNumber}}. {{companyName}}',
        statusMapping: [
          ShipmentStatus.ARRIVED_GHANA,
          ShipmentStatus.RECEIVED_ACCRA,
          ShipmentStatus.RECEIVED_KUMASI,
        ],
      },
      {
        name: 'out_for_delivery',
        title: 'Out for Delivery',
        content:
          'Hello {{customerName}}, your goods are out for delivery. Tracking: {{trackingNumber}}. {{companyName}}',
        statusMapping: [ShipmentStatus.DISPATCHED_KUMASI],
      },
    ];

    for (const org of organizations) {
      for (const template of defaultTemplates) {
        try {
          await this.smsTemplatesService.create(
            {
              name: template.name,
              title: template.title,
              content: template.content,
              statusMapping: template.statusMapping,
              isDefault: true,
              isActive: true,
            },
            org,
          );
          this.logger.log(
            `✓ Created default SMS template: ${template.name} for ${org}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to create template ${template.name} for ${org}:`,
            error.message,
          );
        }
      }
    }
  }
}
