import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { SmsSendEvent } from './sms.events';
import { SmsTemplatesService } from '../sms-templates/sms-templates.service';
import { Organization } from '../user/users.schema';

@Injectable()
export class SmsListener {
  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SmsTemplatesService))
    private readonly smsTemplatesService: SmsTemplatesService,
  ) {}

  @OnEvent('sms.send')
  async handleSmsSendEvent(event: SmsSendEvent) {
    const {
      phoneNumber,
      message,
      templateName,
      templateVariables,
      organization,
      partnerId,
    } = event;

    let finalMessage = message;

    // If template is provided, render it
    if (templateName && organization) {
      try {
        finalMessage = await this.smsTemplatesService.renderTemplateByName(
          templateName,
          templateVariables || {},
          organization as Organization,
          partnerId,
        );
      } catch (error: any) {
        console.error(
          `Failed to render template "${templateName}":`,
          error?.message || error,
        );
        // Fall back to direct message if template rendering fails
        if (!message) {
          console.error('No fallback message provided, skipping SMS');
          return;
        }
      }
    }

    // If no message after template rendering, skip
    if (!finalMessage) {
      console.warn('No message to send, skipping SMS');
      return;
    }

    try {
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = this.configService.get<string>(
        'TWILIO_PHONE_NUMBER',
      );

      if (accountSid && authToken && twilioPhoneNumber) {
        const client = require('twilio')(accountSid, authToken);
        await client.messages.create({
          body: finalMessage,
         // from: twilioPhoneNumber,
          to: phoneNumber,
        });
        console.log(`SMS sent to ${phoneNumber}`);
      } else {
        console.warn('Twilio credentials not found, skipping SMS send');
      }
    } catch (error) {
      console.error('Failed to send SMS via Twilio:', error);
    }
  }
}
