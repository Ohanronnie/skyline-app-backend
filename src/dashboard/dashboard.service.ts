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
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { Warehouse, WarehouseDocument } from '../warehouses/warehouses.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(EventLog.name)
    private readonly eventModel: Model<EventLogDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Warehouse.name)
    private readonly warehouseModel: Model<WarehouseDocument>,
  ) {}

  async stats() {
    const [
      shipments,
      containers,
      customers,
      warehouses,
      inTransit,
      recentShipments,
    ] = await Promise.all([
      this.shipmentModel.countDocuments(),
      this.containerModel.countDocuments(),
      this.customerModel.countDocuments(),
      this.warehouseModel.countDocuments(),
      this.containerModel.countDocuments({
        status: ContainerStatus.IN_TRANSIT,
      }),
      this.shipmentModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('trackingNumber status createdAt customerId partnerId')
        .exec(),
    ]);

    return {
      totals: {
        shipments,
        containers,
        customers,
        warehouses,
        inTransitContainers: inTransit,
      },
      recentActivity: {
        recentShipments,
      },
    };
  }

  async activity() {
    return this.eventModel.find().sort({ createdAt: -1 }).limit(20).exec();
  }

  async insights() {
    // Placeholder for AI insights
    return { summary: 'No insights yet' };
  }
}
