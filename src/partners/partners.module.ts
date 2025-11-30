import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { Partner, PartnerSchema } from './partners.schema';
import { EventsModule } from '../events/events.module';
import { Shipment, ShipmentSchema } from '../shipments/shipments.schema';
import { Customer, CustomerSchema } from '../customers/customers.schema';
import { Container, ContainerSchema } from '../containers/containers.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: Shipment.name, schema: ShipmentSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Container.name, schema: ContainerSchema },
    ]),
    CacheModule.register(),
    EventsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [PartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
