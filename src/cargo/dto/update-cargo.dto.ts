import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CargoType } from '../cargo.schema';

export class UpdateCargoDto {
  @IsString()
  @IsOptional()
  cargoId?: string;

  @IsEnum(CargoType)
  @IsOptional()
  type?: CargoType;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  destination?: string;

  @IsString()
  @IsOptional()
  vesselName?: string;

  @IsString()
  @IsOptional()
  eta?: string; // ISO date string

  @IsMongoId()
  @IsOptional()
  containerId?: string;

  @IsMongoId()
  @IsOptional()
  customerId?: string;

  @IsMongoId()
  @IsOptional()
  partnerId?: string;
}
