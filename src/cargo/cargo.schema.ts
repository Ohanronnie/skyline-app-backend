import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type CargoDocument = HydratedDocument<Cargo>;

export enum CargoType {
  FCL = 'fcl',
  LCL = 'lcl',
  AIR = 'air',
}

@Schema({ timestamps: true })
export class Cargo {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true, unique: true, index: true })
  cargoId: string;

  @Prop({
    type: String,
    enum: Object.values(CargoType),
    required: true,
  })
  type: CargoType;

  @Prop({ type: Number, required: true })
  weight: number;

  @Prop({ type: String, required: true })
  origin: string;

  @Prop({ type: String, required: true })
  destination: string;

  @Prop({ type: String, required: false })
  vesselName?: string;

  @Prop({ type: Date, required: false })
  eta?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Container', required: false })
  containerId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: false })
  customerId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Partner', required: false })
  partnerId?: string;
}

export const CargoSchema = SchemaFactory.createForClass(Cargo);
