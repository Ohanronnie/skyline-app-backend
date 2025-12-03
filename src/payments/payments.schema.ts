import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentType {
  MONTHLY_SUBSCRIPTION = 'monthly_subscription',
}

export enum PaymentPlan {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Partner', required: true, index: true })
  partnerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({
    type: String,
    enum: Object.values(PaymentType),
    required: true,
    default: PaymentType.MONTHLY_SUBSCRIPTION,
  })
  type: PaymentType;

  @Prop({
    type: String,
    enum: Object.values(PaymentPlan),
    required: true,
    default: PaymentPlan.BASIC,
    index: true,
  })
  plan: PaymentPlan;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING,
    index: true,
  })
  status: PaymentStatus;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true, unique: true, index: true })
  clientReference: string;

  @Prop({ type: String, required: false })
  checkoutId?: string;

  @Prop({ type: String, required: false })
  checkoutUrl?: string;

  @Prop({ type: String, required: false })
  checkoutDirectUrl?: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({ type: Date, required: false })
  paidAt?: Date;

  @Prop({ type: Date, required: false })
  dueDate?: Date;

  @Prop({ type: Object, required: false })
  hubtelResponse?: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
