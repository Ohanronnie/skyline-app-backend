import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type TrackingDocument = HydratedDocument<Tracking>;

export enum TrackingEntityType {
  SHIPMENT = 'shipment',
  CONTAINER = 'container',
}

@Schema({ timestamps: true })
export class Tracking {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true, index: true })
  trackingNumber: string;

  @Prop({
    type: String,
    enum: Object.values(TrackingEntityType),
    default: TrackingEntityType.SHIPMENT,
  })
  entityType: TrackingEntityType;

  @Prop({ type: Types.ObjectId })
  entityId?: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;
}

export const TrackingSchema = SchemaFactory.createForClass(Tracking);
