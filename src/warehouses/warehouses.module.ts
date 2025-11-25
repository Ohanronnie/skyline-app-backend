import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Warehouse, WarehouseSchema } from './warehouses.schema';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Warehouse.name, schema: WarehouseSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
  ],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [MongooseModule, WarehousesService],
})
export class WarehousesModule {}
