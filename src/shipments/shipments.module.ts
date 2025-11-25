import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from './shipments.schema';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
    ]),
    AuthModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [MongooseModule, ShipmentsService],
})
export class ShipmentsModule {}
