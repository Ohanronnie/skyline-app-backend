import {
  Body,
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationRecipientType } from './notifications.schema';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/users.schema';
import { BroadcastDto } from './dto/broadcast.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('broadcast')
  @Roles(UserRole.ADMIN)
  async broadcast(@Request() req, @Body() dto: BroadcastDto) {
    return this.notificationsService.broadcast(dto, req.user.organization);
  }
}
