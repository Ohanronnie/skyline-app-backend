import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type CustomerDocument = HydratedDocument<Customer>;

export enum CustomerType {
  AGENT = 'agent',
  CLIENT = 'client',
}

export enum CustomerLocation {
  // International
  CHINA = 'china',
  // Ghana Regions
  GREATER_ACCRA = 'greater_accra',
  ACCRA = 'accra', // Legacy/shorthand for Greater Accra
  ASHANTI = 'ashanti',
  KUMASI = 'kumasi', // Legacy/shorthand for Ashanti
  WESTERN = 'western',
  CENTRAL = 'central',
  EASTERN = 'eastern',
  VOLTA = 'volta',
  OTI = 'oti',
  NORTHERN = 'northern',
  SAVANNAH = 'savannah',
  NORTH_EAST = 'north_east',
  UPPER_EAST = 'upper_east',
  UPPER_WEST = 'upper_west',
  BONO = 'bono',
  BONO_EAST = 'bono_east',
  AHAFO = 'ahafo',
  WESTERN_NORTH = 'western_north',
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

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// Compound unique indexes for email and phone per organization, including deletedAt to allow reuse
CustomerSchema.index(
  { email: 1, organization: 1, deletedAt: 1 },
  { unique: true, sparse: true },
);
CustomerSchema.index(
  { phone: 1, organization: 1, deletedAt: 1 },
  { unique: true, sparse: true },
);

// Query middleware to automatically filter out deleted documents
CustomerSchema.pre(/^find/, function (next) {
  (this as any).where({ deletedAt: null });
  next();
});

CustomerSchema.pre('countDocuments', function (next) {
  (this as any).where({ deletedAt: null });
  next();
});

CustomerSchema.pre('aggregate', function (next) {
  (this as any).pipeline().unshift({ $match: { deletedAt: null } });
  next();
});

CustomerSchema.pre('findOneAndUpdate', function (next) {
  (this as any).where({ deletedAt: null });
  next();
});
