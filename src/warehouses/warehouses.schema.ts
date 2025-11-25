import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Organization } from '../user/users.schema';

export type WarehouseDocument = HydratedDocument<Warehouse>;

export enum WarehouseLocation {
  CHINA = 'china',
  ACCRA = 'accra',
  KUMASI = 'kumasi',
}

@Schema({ timestamps: true })
export class Warehouse {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(WarehouseLocation),
    required: true,
  })
  location: WarehouseLocation;

  @Prop()
  address: string;

  @Prop()
  contactPerson: string;

  @Prop()
  phone: string;

  @Prop({ type: Number, default: 0 })
  capacity: number;

  @Prop({ type: Number, default: 0 })
  currentUtilization: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
