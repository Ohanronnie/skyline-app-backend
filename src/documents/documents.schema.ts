import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Organization } from '../user/users.schema';

export type DocumentFileDocument = HydratedDocument<DocumentFile>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class DocumentFile {
  @Prop({
    type: String,
    enum: Object.values(Organization),
    required: true,
    index: true,
  })
  organization: Organization;

  @Prop({ required: true })
  name: string;

  @Prop()
  type?: string;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ type: Number })
  fileSize?: number;

  @Prop({ type: Types.ObjectId, ref: 'Shipment' })
  shipmentId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Container' })
  containerId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  uploadedBy?: string;
}

export const DocumentFileSchema = SchemaFactory.createForClass(DocumentFile);
