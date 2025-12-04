import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { CargoType } from '../cargo.schema';

export class CreateCargoDto {
  @IsString()
  @IsNotEmpty()
  cargoId: string;

  @IsEnum(CargoType)
  type: CargoType;

  @IsNumber()
  weight: number;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsString()
  @IsOptional()
  vesselName?: string;

  @IsString()
  @IsOptional()
  eta?: string; // ISO date string, will be converted to Date

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
