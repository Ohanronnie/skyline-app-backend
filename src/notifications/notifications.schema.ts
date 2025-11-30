import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Organization } from '../user/users.schema';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationRecipientType {
  USER = 'user',
  CUSTOMER = 'customer',
  PARTNER = 'partner',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  recipientId: string;

  @Prop({ required: true, enum: NotificationRecipientType })
  recipientType: NotificationRecipientType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    required: true,
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @Prop({ default: false })
  read: boolean;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // For storing related entity IDs (e.g., { shipmentId: '...' })
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for efficient querying by recipient
NotificationSchema.index({
  organization: 1,
  recipientId: 1,
  recipientType: 1,
  createdAt: -1,
});
