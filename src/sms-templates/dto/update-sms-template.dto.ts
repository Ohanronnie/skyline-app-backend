import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ShipmentStatus } from '../../shipments/shipments.schema';

export class UpdateSmsTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ShipmentStatus, { each: true })
  statusMapping?: ShipmentStatus[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
