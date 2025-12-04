import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BootstrapService } from './bootstrap.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { WarehousesModule } from './warehouses/warehouses.module';
import { CustomersModule } from './customers/customers.module';
import { ContainersModule } from './containers/containers.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { DocumentsModule } from './documents/documents.module';
import { EventsModule } from './events/events.module';
import { TrackingModule } from './tracking/tracking.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailerModule } from './mailer/mailer.module';
import { PartnersModule } from './partners/partners.module';
import { SmsTemplatesModule } from './sms-templates/sms-templates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { CargoModule } from './cargo/cargo.module';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds
        limit: 1000, // 100 requests per minute
      },
      {
        name: 'auth',
        ttl: 60000, // 60 seconds
        limit: 50, // 5 login attempts per minute
      },
    ]),
    MailerModule,
    AuthModule,
    UserModule,
    WarehousesModule,
    CustomersModule,
    ContainersModule,
    ShipmentsModule,
    DocumentsModule,
    EventsModule,
    TrackingModule,
    ReportsModule,
    DashboardModule,
    PartnersModule,
    SmsTemplatesModule,
    NotificationsModule,
    PaymentsModule,
    CargoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    BootstrapService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
