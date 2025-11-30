import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';
import { Container, ContainerSchema } from '../containers/containers.schema';
import { EventLog, EventLogSchema } from '../events/events.schema';
import { Customer, CustomerSchema } from '../customers/customers.schema';
import { Warehouse, WarehouseSchema } from '../warehouses/warehouses.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: Container.name, schema: ContainerSchema },
      { name: EventLog.name, schema: EventLogSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Warehouse.name, schema: WarehouseSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
