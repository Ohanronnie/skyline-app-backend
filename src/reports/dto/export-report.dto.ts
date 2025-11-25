import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum ReportType {
  SHIPMENTS = 'SHIPMENTS',
  CONTAINERS = 'CONTAINERS',
  FINANCIAL = 'FINANCIAL',
  WAREHOUSE = 'WAREHOUSE',
}

export enum ExportFormat {
  PDF = 'PDF',
  CSV = 'CSV',
  EXCEL = 'EXCEL',
}

export class ExportReportDto {
  @IsEnum(ReportType)
  reportType: ReportType;

  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
