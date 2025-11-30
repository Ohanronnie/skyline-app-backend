import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailListener } from './email.listener';
import { SmsListener } from './sms.listener';
import { EventLog, EventLogSchema } from './events.schema';
import { MailerModule } from '../mailer/mailer.module';
import { SmsTemplatesModule } from '../sms-templates/sms-templates.module';
import { NotificationListener } from './notification.listener';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShipmentSmsListener } from './shipment-sms.listener';
import { Customer, CustomerSchema } from '../customers/customers.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventLog.name, schema: EventLogSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    EventEmitterModule.forRoot(),
    MailerModule,
    forwardRef(() => SmsTemplatesModule),
    NotificationsModule,
  ],
  providers: [
    EmailListener,
    SmsListener,
    NotificationListener,
    ShipmentSmsListener,
  ],
  exports: [
    EmailListener,
    SmsListener,
    NotificationListener,
    ShipmentSmsListener,
  ],
})
export class EventsModule {}
