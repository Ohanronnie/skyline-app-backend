import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Container, ContainerSchema } from './containers.schema';
import { ContainersService } from './containers.service';
import { ContainersController } from './containers.controller';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Container.name, schema: ContainerSchema },
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
  ],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [MongooseModule, ContainersService],
})
export class ContainersModule {}
