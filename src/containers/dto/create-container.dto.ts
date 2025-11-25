import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContainerStatus } from '../containers.schema';

export class CreateContainerDto {
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
}
