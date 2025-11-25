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

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
  ) {}

  async shipmentsAnalytics() {
    const total = await this.shipmentModel.countDocuments();
    const byStatus = await this.shipmentModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { total, byStatus };
  }

  async containersPerformance() {
    const total = await this.containerModel.countDocuments();
    const active = await this.containerModel.countDocuments({
      status: {
        $in: [
          ContainerStatus.LOADING,
          ContainerStatus.LOADED,
          ContainerStatus.IN_TRANSIT,
        ],
      },
    });
    const byStatus = await this.containerModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { total, active, byStatus };
  }

  async financialReports() {
    // Placeholder: in real app, compute revenues/costs
    return { revenue: 0, costs: 0, profit: 0 };
  }

  async warehouseOperations() {
    // Placeholder: add warehouse KPIs later
    return { throughput: 0, occupancyRate: 0 };
  }

  async exportReport(payload: any) {
    // Placeholder export - return CSV/JSON selection
    return { export: 'ok', type: payload?.type ?? 'json' };
  }
}
