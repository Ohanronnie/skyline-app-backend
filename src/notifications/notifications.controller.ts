import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationRecipientType } from './notifications.schema';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getRecipientInfo(user: any) {
    let recipientType = NotificationRecipientType.USER;
    if (user.isCustomer) recipientType = NotificationRecipientType.CUSTOMER;
    else if (user.isPartner) recipientType = NotificationRecipientType.PARTNER;

    return { recipientId: user.userId, recipientType };
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('skip', new ParseIntPipe({ optional: true })) skip = 0,
  ) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    return this.notificationsService.findAll(
      req.user.organization,
      recipientId,
      recipientType,
      limit,
      skip,
    );
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    const count = await this.notificationsService.getUnreadCount(
      req.user.organization,
      recipientId,
      recipientType,
    );
    return { count };
  }

  @Patch('mark-all-read')
  async markAllAsRead(@Request() req) {
    const { recipientId, recipientType } = this.getRecipientInfo(req.user);
    await this.notificationsService.markAllAsRead(
      req.user.organization,
      recipientId,
      recipientType,
    );
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    const { recipientId } = this.getRecipientInfo(req.user);
    return this.notificationsService.markAsRead(
      id,
      req.user.organization,
      recipientId,
    );
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    const { recipientId } = this.getRecipientInfo(req.user);
    return this.notificationsService.delete(
      id,
      req.user.organization,
      recipientId,
    );
  }
}
