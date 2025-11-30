import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationRecipientType } from './notifications.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Organization } from '../user/users.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
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
      .find({ organization, recipientId, recipientType })
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
        organization,
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
        { _id: id, organization, recipientId }, // Ensure user owns the notification
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
        { organization, recipientId, recipientType, read: false },
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
      .deleteOne({ _id: id, organization, recipientId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }
  }
}
