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

  @Prop()
  email?: string;

  @Prop()
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
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
