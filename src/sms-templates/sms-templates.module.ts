import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmsTemplatesService } from './sms-templates.service';
import { SmsTemplatesController } from './sms-templates.controller';
import { SmsTemplate, SmsTemplateSchema } from './sms-templates.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmsTemplate.name, schema: SmsTemplateSchema },
    ]),
  ],
  controllers: [SmsTemplatesController],
  providers: [SmsTemplatesService],
  exports: [SmsTemplatesService],
})
export class SmsTemplatesModule {}
