import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRegisteredEvent } from '../events/user.events';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async createStaff(createDto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.findByEmail(createDto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(createDto.password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = new this.userModel({
      name: createDto.name,
      email: createDto.email.toLowerCase(),
      passwordHash,
      role: createDto.role ?? UserRole.GHANA_STAFF,
      organization: createDto.organization,
      emailVerificationToken,
      emailVerificationExpires,
      emailVerified: true, // Auto-verify all new users
    });

    const savedUser = await user.save();

    // Emit event for email sending
    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(
        savedUser.id,
        savedUser.email,
        savedUser.name,
        emailVerificationToken,
      ),
    );

    return savedUser;
  }

  async listStaff(): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .select('-passwordHash -refreshTokenHash')
      .exec();
  }

  async setRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    const refreshTokenHash = refreshToken
      ? await bcrypt.hash(refreshToken, 10)
      : null;
    await this.userModel
      .updateOne({ _id: userId }, { $set: { refreshTokenHash } })
      .exec();
  }

  async verifyRefreshToken(userId: string, token: string): Promise<boolean> {
    // Check if token is provided and not empty
    if (!token || token.trim() === '') {
      return false;
    }

    const user = await this.userModel
      .findById(userId)
      .select('refreshTokenHash')
      .exec();

    if (!user || !user.refreshTokenHash) {
      return false;
    }

    try {
      return await bcrypt.compare(token, user.refreshTokenHash);
    } catch (error) {
      console.error('Error comparing refresh tokens:', error);
      return false;
    }
  }

  async verifyEmail(token: string): Promise<boolean> {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return false;
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Emit email verified event
    this.eventEmitter.emit('email.verified', {
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    return true;
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.refreshTokenHash = null; // Invalidate all sessions
    await user.save();

    return true;
  }

  async deleteStaff(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Staff not found');
    }
  }
}
