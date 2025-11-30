import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShipmentStatusUpdatedEvent } from './shipment.events';
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { SmsTemplatesService } from '../sms-templates/sms-templates.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SmsSendEvent } from './sms.events';
import { ShipmentStatus } from '../shipments/shipments.schema';

@Injectable()
export class ShipmentSmsListener {
  private readonly logger = new Logger(ShipmentSmsListener.name);

  constructor(
    @InjectModel(Customer.name)
    private customerModel: Model<CustomerDocument>,
    @Inject(forwardRef(() => SmsTemplatesService))
    private readonly smsTemplatesService: SmsTemplatesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('shipment.status.updated')
  async handleShipmentStatusUpdated(event: ShipmentStatusUpdatedEvent) {
    const { shipment, previousStatus } = event;

    this.logger.log(
      `Handling SMS for shipment status update: ${shipment.trackingNumber} -> ${shipment.status}`,
    );

    // Only send SMS to customers, not partners
    if (!shipment.customerId) {
      this.logger.debug('No customer assigned to shipment, skipping SMS');
      return;
    }

    try {
      // Get customer data
      const customer = await this.customerModel
        .findById(shipment.customerId)
        .exec();

      if (!customer) {
        this.logger.warn(
          `Customer ${shipment.customerId} not found for shipment ${shipment.trackingNumber}`,
        );
        return;
      }

      if (!customer.phone) {
        this.logger.warn(
          `Customer ${customer._id} has no phone number, skipping SMS`,
        );
        return;
      }

      // Find SMS template for this status
      const template = await this.smsTemplatesService.findByStatus(
        shipment.status,
        shipment.organization,
        shipment.partnerId?.toString(),
      );

      if (!template) {
        this.logger.warn(
          `No SMS template found for status ${shipment.status} in organization ${shipment.organization}`,
        );
        return;
      }

      // Get company name based on organization
      const companyName =
        shipment.organization === 'skyline' ? 'Skyline' : 'Skyrak';

      // Prepare template variables
      const templateVariables = {
        customerName: customer.name,
        trackingNumber: shipment.trackingNumber,
        companyName: companyName,
      };

      // Emit SMS event
      this.eventEmitter.emit(
        'sms.send',
        new SmsSendEvent(
          customer.phone,
          undefined, // No direct message, use template
          template.name,
          templateVariables,
          shipment.organization,
          shipment.partnerId?.toString(),
        ),
      );

      this.logger.log(
        `SMS event emitted for customer ${customer.name} (${customer.phone}) for shipment ${shipment.trackingNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SMS for shipment ${shipment.trackingNumber}:`,
        error,
      );
    }
  }
}
