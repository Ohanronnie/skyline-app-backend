import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Partner, PartnerDocument, PartnerRole } from './partners.schema';
import { Organization } from '../user/users.schema';

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async create(name: string, phoneNumber: string, organization: Organization): Promise<PartnerDocument> {
    const existing = await this.partnerModel.findOne({ phoneNumber, organization }).exec();
    if (existing) {
      throw new ConflictException('Partner with this phone number already exists in this organization');
    }

    const partner = new this.partnerModel({
      name,
      phoneNumber,
      organization,
      role: PartnerRole.PARTNER,
    });
    return partner.save();
  }

  async findByPhoneNumber(phoneNumber: string, organization: Organization): Promise<PartnerDocument | null> {
    return this.partnerModel.findOne({ phoneNumber, organization }).exec();
  }

  async findAll(organization: Organization): Promise<PartnerDocument[]> {
    return this.partnerModel.find({ organization }).exec();
  }

  // Mock OTP for now - in production this would integrate with SMS provider
  async sendOtp(phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    // In a real app, generate random 6 digit code and send via SMS
    const otp = '123456'; 
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    return { message: 'OTP sent successfully', devOtp: otp };
  }

  async login(phoneNumber: string, otp: string, organization: Organization) {
    // Verify OTP (mock verification)
    if (otp !== '123456') {
      throw new UnauthorizedException('Invalid OTP');
    }

    const partner = await this.findByPhoneNumber(phoneNumber, organization);
    if (!partner) {
      throw new UnauthorizedException('Partner not found');
    }

    if (!partner.isActive) {
      throw new UnauthorizedException('Partner account is inactive');
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
