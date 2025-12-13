import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContainerStatus } from '../containers.schema';

export class UpdateContainerDto {
  @IsString()
  containerNumber: string; // ISO 6346

  @IsOptional()
  @IsString()
  sizeType?: string;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;

  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @IsDateString()
  etaGhana?: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsMongoId()
  partnerId?: string;

  @IsOptional()
  @IsMongoId()
  partnerCustomerId?: string;
}
