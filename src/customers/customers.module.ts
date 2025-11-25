import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from './customers.schema';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [MongooseModule, CustomersService],
})
export class CustomersModule {}
