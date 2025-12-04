import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';
import { Container, ContainerSchema } from '../containers/containers.schema';
import { Customer, CustomerSchema } from '../customers/customers.schema';
import { Partner, PartnerSchema } from '../partners/partners.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: Container.name, schema: ContainerSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Partner.name, schema: PartnerSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
