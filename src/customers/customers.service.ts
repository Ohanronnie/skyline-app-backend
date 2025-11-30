import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { Customer, CustomerDocument } from './customers.schema';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { Organization } from '../user/users.schema';
import { SmsSendEvent } from '../events/sms.events';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    data: Partial<Customer>,
    organization: Organization,
    partnerId?: string,
  ): Promise<CustomerDocument> {
    // Check for duplicate email
    if (data.email) {
      const existingEmail = await this.customerModel
        .findOne({ email: data.email.toLowerCase(), organization })
        .exec();
      if (existingEmail) {
        throw new ConflictException(
          `Customer with email ${data.email} already exists in this organization`,
        );
      }
    }

    // Check for duplicate phone
    if (data.phone) {
      const existingPhone = await this.customerModel
        .findOne({ phone: data.phone, organization })
        .exec();
      if (existingPhone) {
        throw new ConflictException(
          `Customer with phone ${data.phone} already exists in this organization`,
        );
      }
    }

    try {
      const doc = new this.customerModel({
        ...data,
        email: data.email?.toLowerCase(),
        organization,
        partnerId,
      });
      return await doc.save();
    } catch (error: any) {
      if (error.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(
          `Customer with ${field} already exists in this organization`,
        );
      }
      throw error;
    }
  }

  async findAll(
    organization: Organization,
    partnerId?: string,
  ): Promise<CustomerDocument[]> {
    const filter: any = { organization };
    if (partnerId) {
      filter.partnerId = partnerId;
    }
    return this.customerModel.find(filter).exec();
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<CustomerDocument> {
    const found = await this.customerModel
      .findOne({ _id: id, organization })
      .exec();
    if (!found) throw new NotFoundException('Customer not found');
    return found;
  }

  async findById(id: string): Promise<CustomerDocument> {
    const found = await this.customerModel.findById(id).exec();
    if (!found) throw new NotFoundException('Customer not found');
    return found;
  }

  async findByEmail(
    email: string,
    organization: Organization,
  ): Promise<CustomerDocument | null> {
    return this.customerModel
      .findOne({ email: email.toLowerCase(), organization })
      .exec();
  }

  async update(
    id: string,
    data: Partial<Customer>,
    organization: Organization,
    partnerId?: string,
  ): Promise<CustomerDocument> {
    // First, verify the customer exists and belongs to the partner (if partnerId provided)
    const existingCustomer = await this.customerModel
      .findOne({ _id: id, organization })
      .exec();

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found');
    }

    // If partnerId is provided, ensure the customer belongs to that partner
    if (partnerId && existingCustomer.partnerId?.toString() !== partnerId) {
      throw new NotFoundException('Customer not found');
    }

    // Check for duplicate email (excluding current customer)
    if (data.email) {
      const existingEmail = await this.customerModel
        .findOne({
          email: data.email.toLowerCase(),
          organization,
          _id: { $ne: id },
        })
        .exec();
      if (existingEmail) {
        throw new ConflictException(
          `Customer with email ${data.email} already exists in this organization`,
        );
      }
    }

    // Check for duplicate phone (excluding current customer)
    if (data.phone) {
      const existingPhone = await this.customerModel
        .findOne({
          phone: data.phone,
          organization,
          _id: { $ne: id },
        })
        .exec();
      if (existingPhone) {
        throw new ConflictException(
          `Customer with phone ${data.phone} already exists in this organization`,
        );
      }
    }

    try {
      const updateData = { ...data };
      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase();
      }

      const filter: any = { _id: id, organization };
      if (partnerId) {
        filter.partnerId = partnerId;
      }

      const updated = await this.customerModel
        .findOneAndUpdate(filter, { $set: updateData }, { new: true })
        .exec();
      if (!updated) throw new NotFoundException('Customer not found');
      return updated;
    } catch (error: any) {
      if (error.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(
          `Customer with ${field} already exists in this organization`,
        );
      }
      throw error;
    }
  }

  async shipments(
    id: string,
    organization: Organization,
  ): Promise<ShipmentDocument[]> {
    await this.findOne(id, organization);
    return this.shipmentModel.find({ customerId: id, organization }).exec();
  }

  async search(
    query: string,
    organization: Organization,
  ): Promise<CustomerDocument[]> {
    // Sanitize input to prevent ReDoS attacks
    const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      organization,
      $or: [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
        { phone: { $regex: sanitized, $options: 'i' } },
      ],
    };
    return this.customerModel.find(filter).exec();
  }

  // Send OTP via Event and Cache
  async sendOtp(
    phoneNumber: string,
  ): Promise<{ message: string; devOtp?: string }> {
    const customer = await this.customerModel
      .findOne({ phone: phoneNumber })
      .exec();
    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    // Prevent partner-assigned customers from logging in
    if (customer.partnerId) {
      throw new UnauthorizedException(
        'This customer account is managed by a partner and cannot login directly',
      );
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving
    const salt = await bcrypt.genSalt();
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save hashed OTP to cache with 5 minutes TTL
    await this.cacheManager.set(
      `otp:customer:${phoneNumber}`,
      hashedOtp,
      300000,
    );

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
    const customer = await this.customerModel
      .findOne({ phone: phoneNumber, organization })
      .exec();

    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    // Prevent partner-assigned customers from logging in
    if (customer.partnerId) {
      throw new UnauthorizedException(
        'This customer account is managed by a partner and cannot login directly',
      );
    }

    // Retrieve OTP from cache
    const hashedOtp = await this.cacheManager.get<string>(
      `otp:customer:${phoneNumber}`,
    );

    if (!hashedOtp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    const isMatch = await bcrypt.compare(otp, hashedOtp);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP from cache after successful login
    await this.cacheManager.del(`otp:customer:${phoneNumber}`);

    return this.issueTokens(customer);
  }

  async issueTokens(customer: CustomerDocument) {
    const payload = {
      sub: customer._id.toString(),
      organization: customer.organization,
      isCustomer: true,
      role: 'customer', // Adding role for frontend compatibility
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

    await this.setRefreshToken(customer._id.toString(), refreshToken);

    return {
      user: customer,
      accessToken,
      refreshToken,
    };
  }

  private async verifyRefreshToken(
    customerId: string,
    token: string,
  ): Promise<boolean> {
    if (!token || token.trim() === '') {
      return false;
    }

    const customer = await this.customerModel
      .findById(customerId)
      .select('refreshTokenHash')
      .exec();

    if (!customer || !customer.refreshTokenHash) {
      return false;
    }

    try {
      return await bcrypt.compare(token, customer.refreshTokenHash);
    } catch (error) {
      console.error('Error comparing customer refresh tokens:', error);
      return false;
    }
  }

  async refresh(customerId: string, token: string) {
    const isValid = await this.verifyRefreshToken(customerId, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) {
      throw new UnauthorizedException('Customer not found');
    }

    return this.issueTokens(customer);
  }

  async setRefreshToken(customerId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(refreshToken, salt);
    await this.customerModel.findByIdAndUpdate(customerId, {
      refreshTokenHash: hash,
    });
  }
}
