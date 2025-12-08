import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { Partner, PartnerDocument, PartnerRole } from './partners.schema';
import { Organization } from '../user/users.schema';
import { SmsSendEvent } from '../events/sms.events';
import { buildOrganizationFilter } from '../auth/organization-filter.util';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { Container, ContainerDocument } from '../containers/containers.schema';

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  private toObjectId(id: string | Types.ObjectId): string {
    return typeof id === 'string' ? id : id.toString();
  }

  private async attachStats(partner: PartnerDocument): Promise<
    Partner & {
      shipmentCount: number;
      customerCount: number;
      containerCount: number;
    }
  > {
    const partnerId = this.toObjectId(partner._id);

    const [shipmentCount, customerCount, partnerShipments] = await Promise.all([
      this.shipmentModel.countDocuments({
        partnerId,
      }),
      this.customerModel.countDocuments({
        partnerId,
      }),
      this.shipmentModel
        .find({ partnerId, ...buildOrganizationFilter(partner.organization) })
        .select('containerId')
        .exec(),
    ]);

    // Count unique containers that have shipments belonging to this partner
    const containerIds = [
      ...new Set(
        partnerShipments
          .map((s) => s.containerId?.toString())
          .filter((id): id is string => id !== undefined),
      ),
    ];
    const containerCount =
      containerIds.length > 0
        ? await this.containerModel.countDocuments({
            _id: { $in: containerIds },
            ...buildOrganizationFilter(partner.organization),
          })
        : 0;

    return {
      ...(partner.toObject() as Partner),
      shipmentCount,
      customerCount,
      containerCount,
    };
  }

  async create(
    name: string,
    phoneNumber: string,
    organization: Organization,
    email?: string,
  ): Promise<PartnerDocument> {
    const existing = await this.partnerModel
      .findOne({ phoneNumber, ...buildOrganizationFilter(organization) })
      .exec();
    if (existing) {
      throw new ConflictException(
        'Partner with this phone number already exists in this organization',
      );
    }

    const partner = new this.partnerModel({
      name,
      phoneNumber,
      organization,
      role: PartnerRole.PARTNER,
      email,
    });
    return partner.save();
  }

  async findByPhoneNumber(
    phoneNumber: string,
    organization: Organization,
  ): Promise<PartnerDocument | null> {
    return this.partnerModel
      .findOne({ phoneNumber, ...buildOrganizationFilter(organization) })
      .exec();
  }

  async findAll(organization: Organization) {
    const partners = await this.partnerModel
      .find(buildOrganizationFilter(organization))
      .exec();
    return Promise.all(partners.map((p) => this.attachStats(p)));
  }

  async findById(id: string) {
    const partner = await this.partnerModel.findById(id).exec();
    if (!partner) return null;
    return this.attachStats(partner);
  }

  /**
   * Admin feature: Issue tokens for a partner account (impersonation)
   * Allows admins to access partner accounts and perform actions as that partner
   */
  async accessPartnerAsAdmin(
    partnerId: string,
    organization: Organization,
  ): Promise<{
    user: PartnerDocument;
    accessToken: string;
    refreshToken: string;
  }> {
    const partner = await this.partnerModel
      .findOne({
        _id: partnerId,
        ...buildOrganizationFilter(organization),
      })
      .exec();

    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    if (!partner.isActive) {
      throw new UnauthorizedException('Partner account is inactive');
    }

    // Issue tokens as if the partner logged in
    return this.issueTokens(partner);
  }

  async getCustomers(partnerId: string, organization: Organization) {
    return this.customerModel
      .find({ partnerId, ...buildOrganizationFilter(organization) })
      .exec();
  }

  // Send OTP via Event and Cache
  async sendOtp(
    phoneNumber: string,
  ): Promise<{ message: string; devOtp?: string }> {
    const partner = await this.partnerModel.findOne({ phoneNumber }).exec();
    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving
    const salt = await bcrypt.genSalt();
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save hashed OTP to cache with 5 minutes TTL
    await this.cacheManager.set(`otp:${phoneNumber}`, hashedOtp, 300000); // 300000ms = 5 mins

    // Emit SMS event
    this.eventEmitter.emit(
      'sms.send',
      new SmsSendEvent(
        phoneNumber,
        `Your Skyline verification code is: ${otp}`,
      ),
    );

    // In development, log the OTP
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';
    if (isDev) {
      console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
    }

    return {
      message: 'OTP sent successfully',
    };
  }

  async login(phoneNumber: string, otp: string, organization: Organization) {
    const partner = await this.partnerModel
      .findOne({ phoneNumber, ...buildOrganizationFilter(organization) })
      .select('+role')
      .exec();

    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    if (!partner.isActive) {
      throw new UnauthorizedException('Partner account is inactive');
    }

    // Retrieve OTP from cache
    const hashedOtp = await this.cacheManager.get<string>(`otp:${phoneNumber}`);

    if (!hashedOtp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    const isMatch = await bcrypt.compare(otp, hashedOtp);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP from cache after successful login
    await this.cacheManager.del(`otp:${phoneNumber}`);

    return this.issueTokens(partner);
  }

  private async verifyRefreshToken(
    partnerId: string,
    token: string,
  ): Promise<boolean> {
    if (!token || token.trim() === '') {
      return false;
    }

    const partner = await this.partnerModel
      .findById(partnerId)
      .select('refreshTokenHash')
      .exec();

    if (!partner || !partner.refreshTokenHash) {
      return false;
    }

    try {
      return await bcrypt.compare(token, partner.refreshTokenHash);
    } catch (error) {
      console.error('Error comparing partner refresh tokens:', error);
      return false;
    }
  }

  async dashboard(partnerId: string) {
    const partner = await this.partnerModel
      .findById(this.toObjectId(partnerId))
      .exec();
    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    const [stats, recentShipments] = await Promise.all([
      this.attachStats(partner),
      this.shipmentModel
        .find({ partnerId: partner._id.toString() })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('trackingNumber status createdAt customerId')
        .populate('customerId', 'name email phone location type')
        .exec(),
    ]);

    return {
      partner: stats,
      recentActivity: {
        recentShipments,
      },
    };
  }

  async update(
    partnerId: string,
    updateData: {
      name?: string;
      businessRegistrationNumber?: string;
      email?: string;
      phoneNumber?: string;
      businessAddress?: string;
    },
  ): Promise<PartnerDocument> {
    const partner = await this.partnerModel
      .findById(this.toObjectId(partnerId))
      .exec();
    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    // Check for phone number conflict if phoneNumber is being updated
    if (
      updateData.phoneNumber &&
      updateData.phoneNumber !== partner.phoneNumber
    ) {
      const existingPartner = await this.partnerModel
        .findOne({
          phoneNumber: updateData.phoneNumber,
          ...buildOrganizationFilter(partner.organization),
          _id: { $ne: partner._id },
        })
        .exec();
      if (existingPartner) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // Check for email conflict if email is being updated
    if (updateData.email && updateData.email !== partner.email) {
      const existingPartner = await this.partnerModel
        .findOne({
          email: updateData.email?.toLowerCase().trim(),
          ...buildOrganizationFilter(partner.organization),
          _id: { $ne: partner._id },
        })
        .exec();
      if (existingPartner) {
        throw new ConflictException('Email already in use');
      }
    }

    // Update only provided fields
    const updateFields: any = {};
    if (updateData.name !== undefined) updateFields.name = updateData.name;
    if (updateData.businessRegistrationNumber !== undefined)
      updateFields.businessRegistrationNumber =
        updateData.businessRegistrationNumber;
    if (updateData.email !== undefined)
      updateFields.email = updateData.email.toLowerCase().trim();
    if (updateData.phoneNumber !== undefined)
      updateFields.phoneNumber = updateData.phoneNumber;
    if (updateData.businessAddress !== undefined)
      updateFields.businessAddress = updateData.businessAddress;

    const updated = await this.partnerModel
      .findByIdAndUpdate(partner._id, updateFields, { new: true })
      .exec();

    if (!updated) {
      throw new UnauthorizedException('Partner not found');
    }

    return updated;
  }

  async refresh(partnerId: string, token: string) {
    const isValid = await this.verifyRefreshToken(partnerId, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const partner = await this.partnerModel.findById(partnerId).exec();
    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    return this.issueTokens(partner);
  }

  async issueTokens(partner: PartnerDocument) {
    const payload = {
      sub: partner._id.toString(),
      role: partner.role,
      organization: partner.organization,
      isPartner: true,
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

    await this.setRefreshToken(partner._id.toString(), refreshToken);

    return {
      user: partner,
      accessToken,
      refreshToken,
    };
  }

  async setRefreshToken(partnerId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.partnerModel.findByIdAndUpdate(partnerId, {
      refreshTokenHash: hash,
    });
  }
}
