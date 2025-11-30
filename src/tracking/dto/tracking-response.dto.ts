import { Shipment } from '../../shipments/shipments.schema';
import { Container } from '../../containers/containers.schema';

export interface TrackingEntryDto {
  id: string;
  status: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type TrackingEntityResponse =
  | { type: 'shipment'; data: Shipment }
  | { type: 'container'; data: Container }
  | { type: 'unknown'; data: null };

export type TrackingTimelineResponseDto = TrackingEntityResponse & {
  tracking: TrackingEntryDto[];
};
