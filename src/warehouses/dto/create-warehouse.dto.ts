import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { WarehouseLocation } from '../warehouses.schema';

export class CreateWarehouseDto {
  @IsString()
  name: string;

  @IsEnum(WarehouseLocation)
  location: WarehouseLocation;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsInt()
  currentUtilization?: number;
}
