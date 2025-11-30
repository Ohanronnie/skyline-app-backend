import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Organization } from '../user/users.schema';

export type PartnerDocument = HydratedDocument<Partner>;

export enum PartnerRole {
  PARTNER = 'partner',
}

@Schema({ timestamps: true })
export class Partner {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true, unique: true, index: true })
  phoneNumber: string;

  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
  })
  organization: Organization;

  @Prop({
    type: String,
    enum: Object.values(PartnerRole),
    default: PartnerRole.PARTNER,
  })
  role: PartnerRole;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash?: string | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ required: false })
  businessRegistrationNumber?: string;

  @Prop({ required: false })
  businessAddress?: string;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
