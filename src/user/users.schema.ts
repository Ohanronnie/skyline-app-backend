import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  ADMIN = 'admin',
  CHINA_STAFF = 'china_staff',
  GHANA_STAFF = 'ghana_staff',
}

export enum Organization {
  SKYLINE = 'skyline',
  SKYRAK = 'skyrak',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.GHANA_STAFF,
  })
  role: UserRole;

  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
  })
  organization: Organization;

  @Prop({ type: 'ObjectId', ref: 'Warehouse', default: null })
  warehouseId?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  emailVerified: boolean;

  @Prop({ type: String, default: null })
  emailVerificationToken?: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpires?: Date | null;

  @Prop({ type: String, default: null })
  passwordResetToken?: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpires?: Date | null;

  @Prop({ type: String, default: null, required: false })
  refreshTokenHash?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
