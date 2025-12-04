import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';
import { Cargo, CargoSchema } from './cargo.schema';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cargo.name, schema: CargoSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
  ],
  controllers: [CargoController],
  providers: [CargoService],
})
export class CargoModule {}
