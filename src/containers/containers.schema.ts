import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Organization } from '../user/users.schema';

export type ContainerDocument = HydratedDocument<Container>;

export enum ContainerStatus {
  REGISTERED = 'registered',
  RECEIVED = 'received',
  LOADING = 'loading',
  LOADED = 'loaded',
  SENDING = 'sending',
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  UNLOADED = 'unloaded',
  DELIVERED = 'delivered',
}

@Schema({ timestamps: true })
export class Container {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  containerNumber: string; // ISO 6346

  @Prop()
  sizeType?: string;

  @Prop()
  vesselName?: string;

  @Prop({
    type: String,
    enum: Object.values(ContainerStatus),
    default: ContainerStatus.REGISTERED,
  })
  status: ContainerStatus;

  @Prop()
  departureDate?: Date;

  @Prop()
  etaGhana?: Date;

  @Prop()
  arrivalDate?: Date;

  @Prop()
  currentLocation?: string;
}

export const ContainerSchema = SchemaFactory.createForClass(Container);
