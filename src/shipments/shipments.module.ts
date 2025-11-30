import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shipment, ShipmentSchema } from './shipments.schema';
import { ShipmentsService } from './shipments.service';
import { ShipmentsController } from './shipments.controller';
import { AuthModule } from '../auth/auth.module';
import { Tracking, TrackingSchema } from '../tracking/tracking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: Tracking.name, schema: TrackingSchema },
    ]),
    AuthModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [MongooseModule, ShipmentsService],
})
export class ShipmentsModule {}
