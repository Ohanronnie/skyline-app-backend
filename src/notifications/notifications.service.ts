import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationRecipientType,
  NotificationType,
} from './notifications.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Organization } from '../user/users.schema';
import { InjectModel as InjectMongooseModel } from '@nestjs/mongoose';
import { buildOrganizationFilter } from '../auth/organization-filter.util';
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { Partner, PartnerDocument } from '../partners/partners.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SmsSendEvent } from '../events/sms.events';
import { BroadcastDto, BroadcastTarget } from './dto/broadcast.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectMongooseModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectMongooseModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
    organization: Organization,
  ): Promise<NotificationDocument> {
    const notification = new this.notificationModel({
      ...createNotificationDto,
      organization,
    });
    return notification.save();
  }

  async findAll(
    organization: Organization,
    recipientId: string,
    recipientType: NotificationRecipientType,
    limit = 20,
    skip = 0,
  ): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({
        ...buildOrganizationFilter(organization),
        recipientId,
        recipientType,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getUnreadCount(
    organization: Organization,
    recipientId: string,
    recipientType: NotificationRecipientType,
  ): Promise<number> {
    return this.notificationModel
      .countDocuments({
        ...buildOrganizationFilter(organization),
        recipientId,
        recipientType,
        read: false,
      })
      .exec();
  }

  async markAsRead(
    id: string,
    organization: Organization,
    recipientId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, ...buildOrganizationFilter(organization), recipientId }, // Ensure user owns the notification
        { read: true },
        { new: true },
      )
      .exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAllAsRead(
    organization: Organization,
    recipientId: string,
    recipientType: NotificationRecipientType,
  ): Promise<void> {
    await this.notificationModel
      .updateMany(
        {
          ...buildOrganizationFilter(organization),
          recipientId,
          recipientType,
          read: false,
        },
        { read: true },
      )
      .exec();
  }

  async delete(
    id: string,
    organization: Organization,
    recipientId: string,
  ): Promise<void> {
    const result = await this.notificationModel
      .deleteOne({
        _id: id,
        ...buildOrganizationFilter(organization),
        recipientId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  /**
   * Broadcast a message as notifications and/or SMS to customers/partners.
   */
  async broadcast(
    dto: BroadcastDto,
    organization: Organization,
  ): Promise<{ count: number }> {
    const {
      target,
      title,
      message,
      type,
      sendSms = true,
      sendNotification = true,
      recipientId,
    } = dto;

    if (!sendSms && !sendNotification) {
      throw new BadRequestException(
        'At least one of sendSms or sendNotification must be true',
      );
    }

    // Resolve recipients
    let customers: CustomerDocument[] = [];
    let partners: PartnerDocument[] = [];

    if (
      target === BroadcastTarget.ALL ||
      target === BroadcastTarget.CUSTOMERS
    ) {
      customers = await this.customerModel
        .find(buildOrganizationFilter(organization))
        .exec();
    }

    if (target === BroadcastTarget.ALL || target === BroadcastTarget.PARTNERS) {
      partners = await this.partnerModel
        .find({ ...buildOrganizationFilter(organization), isActive: true })
        .exec();
    }

    if (
      target === BroadcastTarget.CUSTOMER ||
      target === BroadcastTarget.PARTNER
    ) {
      if (!recipientId) {
        throw new BadRequestException(
          'recipientId is required when target is customer or partner',
        );
      }
      if (target === BroadcastTarget.CUSTOMER) {
        const customer = await this.customerModel
          .findOne({
            _id: recipientId,
            ...buildOrganizationFilter(organization),
          })
          .exec();
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
        customers = [customer];
      } else {
        const partner = await this.partnerModel
          .findOne({
            _id: recipientId,
            ...buildOrganizationFilter(organization),
            isActive: true,
          })
          .exec();
        if (!partner) {
          throw new NotFoundException('Partner not found');
        }
        partners = [partner];
      }
    }

    let count = 0;
    const notificationType = type ?? NotificationType.INFO;

    // Create notifications + SMS for customers
    for (const customer of customers) {
      if (sendNotification) {
        await this.create(
          {
            recipientId: customer._id.toString(),
            recipientType: NotificationRecipientType.CUSTOMER,
            title,
            message,
            type: notificationType,
          },
          organization,
        );
        count++;
      }
      if (sendSms && customer.phone) {
        this.eventEmitter.emit(
          'sms.send',
          new SmsSendEvent(
            customer.phone,
            message,
            undefined,
            undefined,
            organization,
          ),
        );
      }
    }

    // Create notifications + SMS for partners
    for (const partner of partners) {
      if (sendNotification) {
        await this.create(
          {
            recipientId: partner._id.toString(),
            recipientType: NotificationRecipientType.PARTNER,
            title,
            message,
            type: notificationType,
          },
          organization,
        );
        count++;
      }
      if (sendSms && partner.phoneNumber) {
        this.eventEmitter.emit(
          'sms.send',
          new SmsSendEvent(
            partner.phoneNumber,
            message,
            undefined,
            undefined,
            organization,
            partner._id.toString(),
          ),
        );
      }
    }

    return { count };
  }
}
