import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ShipmentStatus } from '../shipments.schema';

export class CreateShipmentDto {
  @IsString()
  trackingNumber: string;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  cbm?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  receivedQuantity?: number;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsMongoId()
  originWarehouseId?: string;

  @IsOptional()
  @IsMongoId()
  currentWarehouseId?: string;

  @IsOptional()
  @IsMongoId()
  containerId?: string;
}
