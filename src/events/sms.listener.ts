import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { SmsSendEvent } from './sms.events';
import { SmsTemplatesService } from '../sms-templates/sms-templates.service';
import { Organization } from '../user/users.schema';
import axios from 'axios';

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
      const arkeselApiKey = this.configService.get<string>('ARKESEL_API_KEY');
      
      if (arkeselApiKey) {
        const response = await axios.get('https://sms.arkesel.com/sms/api', {
          params: {
            action: 'send-sms',
            api_key: arkeselApiKey,
            to: phoneNumber,
            from: 'Skyline',
            sms: finalMessage,
          },
        });

        if (response.data.code === 'ok') {
          console.log(`SMS successfully sent to ${phoneNumber} via Arkesel`);
        } else {
          console.warn(`Arkesel SMS response error: ${JSON.stringify(response.data)}`);
        }
      } else {
        console.warn('ARKESEL_API_KEY not found, skipping SMS send');
      }
    } catch (error: any) {
      console.error(
        'Failed to send SMS via Arkesel:',
        error.response?.data || error.message,
      );
    }
  }
}
