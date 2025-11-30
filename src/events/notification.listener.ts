import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import { ShipmentStatusUpdatedEvent } from './shipment.events';
import {
  NotificationRecipientType,
  NotificationType,
} from '../notifications/notifications.schema';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('shipment.status.updated')
  async handleShipmentStatusUpdated(event: ShipmentStatusUpdatedEvent) {
    const { shipment, previousStatus } = event;

    this.logger.log(
      `Handling shipment.status.updated for ${shipment.trackingNumber}`,
    );

    try {
      // Notify Customer if assigned
      if (shipment.customerId) {
        await this.notificationsService.create(
          {
            recipientId: shipment.customerId.toString(),
            recipientType: NotificationRecipientType.CUSTOMER,
            title: 'Shipment Status Updated',
            message: `Your shipment ${shipment.trackingNumber} has been updated from ${previousStatus} to ${shipment.status}.`,
            type: NotificationType.INFO,
            metadata: {
              shipmentId: shipment._id.toString(),
              trackingNumber: shipment.trackingNumber,
            },
          },
          shipment.organization,
        );
      }

      // Notify Partner if assigned
      if (shipment.partnerId) {
        await this.notificationsService.create(
          {
            recipientId: shipment.partnerId.toString(),
            recipientType: NotificationRecipientType.PARTNER,
            title: 'Shipment Status Updated',
            message: `Shipment ${shipment.trackingNumber} assigned to you has been updated from ${previousStatus} to ${shipment.status}.`,
            type: NotificationType.INFO,
            metadata: {
              shipmentId: shipment._id.toString(),
              trackingNumber: shipment.trackingNumber,
            },
          },
          shipment.organization,
        );
      }
    } catch (error) {
      this.logger.error('Failed to create notification', error);
    }
  }
}
