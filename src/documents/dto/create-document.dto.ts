import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export enum DocumentType {
  INVOICE = 'INVOICE',
  PACKING_LIST = 'PACKING_LIST',
  BILL_OF_LADING = 'BILL_OF_LADING',
  CUSTOMS = 'CUSTOMS',
  CERTIFICATE = 'CERTIFICATE',
  IMAGE = 'IMAGE',
  OTHER = 'OTHER',
}

export class CreateDocumentDto {
  @IsOptional()
  @IsMongoId()
  @ValidateIf((o) => !o.containerId) // Required if containerId is not provided
  shipmentId?: string;

  @IsOptional()
  @IsMongoId()
  @ValidateIf((o) => !o.shipmentId) // Required if shipmentId is not provided
  containerId?: string;

  @IsString()
  name: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsUrl()
  fileUrl: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
