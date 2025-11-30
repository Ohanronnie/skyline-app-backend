import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';
import { ShipmentStatus } from '../shipments/shipments.schema';

export type SmsTemplateDocument = HydratedDocument<SmsTemplate>;

@Schema({ timestamps: true })
export class SmsTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: [String],
    enum: Object.values(ShipmentStatus),
    required: false,
  })
  statusMapping?: ShipmentStatus[];

  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
  })
  organization: Organization;

  @Prop({ type: Types.ObjectId, ref: 'Partner', required: false })
  partnerId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: string;

  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const SmsTemplateSchema = SchemaFactory.createForClass(SmsTemplate);

// 1. Index for Default Templates: Unique by name + organization where isDefault is true
SmsTemplateSchema.index(
  { organization: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
    name: 'unique_default_template',
  },
);

// 2. Index for Partner Templates: Unique by name + organization + partnerId where partnerId exists
SmsTemplateSchema.index(
  { organization: 1, partnerId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { partnerId: { $type: 'objectId' } },
    name: 'unique_partner_template',
  },
);

// 3. Index for User Templates: Unique by name + organization + userId where userId exists
SmsTemplateSchema.index(
  { organization: 1, userId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
    name: 'unique_user_template',
  },
);
