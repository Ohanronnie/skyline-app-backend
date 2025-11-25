import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EventLogDocument = HydratedDocument<EventLog>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class EventLog {
  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ type: Object })
  eventData?: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: string;

  @Prop()
  ipAddress?: string;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);
