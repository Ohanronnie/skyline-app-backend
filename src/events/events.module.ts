import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventLog, EventLogSchema } from './events.schema';
import { EmailListener } from './email.listener';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventLog.name, schema: EventLogSchema },
    ]),
    MailerModule,
  ],
  providers: [EmailListener],
  exports: [MongooseModule],
})
export class EventsModule {}
