import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { ShipmentStatus } from '../../shipments/shipments.schema';
import {
  CustomerLocation,
  CustomerType,
} from '../../customers/customers.schema';

export enum ReportType {
  SHIPMENTS = 'shipments',
  CUSTOMERS = 'customers',
  CONTAINERS = 'containers',
}

export enum ReportMode {
  SUMMARY = 'summary',
  DETAILED = 'detailed',
}

export class GenerateExcelReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportMode)
  mode: ReportMode;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsMongoId()
  @IsOptional()
  partnerId?: string;

  @IsMongoId()
  @IsOptional()
  customerId?: string;

  @IsMongoId()
  @IsOptional()
  containerId?: string;

  @IsArray()
  @IsEnum(ShipmentStatus, { each: true })
  @IsOptional()
  shipmentStatuses?: ShipmentStatus[];

  @IsArray()
  @IsEnum(CustomerType, { each: true })
  @IsOptional()
  customerTypes?: CustomerType[];

  @IsArray()
  @IsEnum(CustomerLocation, { each: true })
  @IsOptional()
  locations?: CustomerLocation[];

  @IsOptional()
  onlyWithShipments?: boolean;
}
