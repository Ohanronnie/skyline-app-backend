import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type CustomerDocument = HydratedDocument<Customer>;

export enum CustomerType {
  AGENT = 'agent',
  CLIENT = 'client',
}

export enum CustomerLocation {
  CHINA = 'china',
  ACCRA = 'accra',
  KUMASI = 'kumasi',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Customer {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: Object.values(CustomerType), required: true })
  type: CustomerType;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop()
  address?: string;

  @Prop({ type: String, enum: Object.values(CustomerLocation), required: true })
  location: CustomerLocation;

  @Prop()
  paymentTerms?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Partner', required: false, index: true })
  partnerId?: string;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash?: string | null;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// Compound unique indexes for email and phone per organization
CustomerSchema.index(
  { email: 1, organization: 1 },
  { unique: true, sparse: true },
);
CustomerSchema.index(
  { phone: 1, organization: 1 },
  { unique: true, sparse: true },
);
