import { IsObject, IsOptional, IsString } from 'class-validator';

export class WebhookDto {
  @IsString()
  event: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  containerNumber?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
