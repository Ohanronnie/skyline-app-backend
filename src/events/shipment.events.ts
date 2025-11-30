import { ShipmentDocument, ShipmentStatus } from '../shipments/shipments.schema';

export class ShipmentStatusUpdatedEvent {
  constructor(
    public readonly shipment: ShipmentDocument,
    public readonly previousStatus: ShipmentStatus,
  ) {}
}
