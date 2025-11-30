import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean, IsObject } from 'class-validator';
import { NotificationType, NotificationRecipientType } from '../notifications.schema';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsEnum(NotificationRecipientType)
  @IsNotEmpty()
  recipientType: NotificationRecipientType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
