import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type ShipmentDocument = HydratedDocument<Shipment>;

export enum ShipmentStatus {
  RECEIVED = 'received',
  INSPECTED = 'inspected',
  LOADED = 'loaded',
  IN_TRANSIT = 'in_transit',
  ARRIVED_GHANA = 'arrived_ghana',
  DELIVERED = 'delivered',
  // Extended granular statuses by location (non-breaking additions)
  RECEIVED_CHINA = 'received_china',
  LOADED_CHINA = 'loaded_china',
  RECEIVED_ACCRA = 'received_accra',
  DELIVERED_ACCRA = 'delivered_accra',
  DISPATCHED_KUMASI = 'dispatched_kumasi',
  RECEIVED_KUMASI = 'received_kumasi',
  DELIVERED_KUMASI = 'delivered_kumasi',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Shipment {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  trackingNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: false })
  customerId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Partner', required: false, index: true })
  partnerId?: string;

  @Prop()
  description?: string;

  @Prop({ type: Number })
  cbm?: number;

  @Prop({ type: Number })
  quantity?: number;

  @Prop({ type: Number })
  receivedQuantity?: number;

  @Prop({
    type: String,
    enum: Object.values(ShipmentStatus),
    default: ShipmentStatus.RECEIVED,
  })
  status: ShipmentStatus;

  @Prop({ type: Types.ObjectId, ref: 'Warehouse' })
  originWarehouseId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Warehouse' })
  currentWarehouseId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Container' })
  containerId?: string;

  @Prop()
  receivedAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);
