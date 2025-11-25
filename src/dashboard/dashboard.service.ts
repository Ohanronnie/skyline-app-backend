import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Shipment,
  ShipmentDocument,
  ShipmentStatus,
} from '../shipments/shipments.schema';
import {
  Container,
  ContainerDocument,
  ContainerStatus,
} from '../containers/containers.schema';
import { EventLog, EventLogDocument } from '../events/events.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(EventLog.name)
    private readonly eventModel: Model<EventLogDocument>,
  ) {}

  async stats() {
    const [shipments, containers] = await Promise.all([
      this.shipmentModel.countDocuments(),
      this.containerModel.countDocuments(),
    ]);
    const inTransit = await this.containerModel.countDocuments({
      status: ContainerStatus.IN_TRANSIT,
    });
    return { shipments, containers, inTransit };
  }

  async activity() {
    return this.eventModel.find().sort({ createdAt: -1 }).limit(20).exec();
  }

  async insights() {
    // Placeholder for AI insights
    return { summary: 'No insights yet' };
  }
}
