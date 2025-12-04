import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationType } from '../notifications.schema';

export enum BroadcastTarget {
  ALL = 'all',
  CUSTOMERS = 'customers',
  PARTNERS = 'partners',
  CUSTOMER = 'customer',
  PARTNER = 'partner',
}

export class BroadcastDto {
  @IsEnum(BroadcastTarget)
  target: BroadcastTarget;

  @IsMongoId()
  @IsOptional()
  recipientId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.INFO;

  @IsBoolean()
  @IsOptional()
  sendSms?: boolean = true;

  @IsBoolean()
  @IsOptional()
  sendNotification?: boolean = true;
}
