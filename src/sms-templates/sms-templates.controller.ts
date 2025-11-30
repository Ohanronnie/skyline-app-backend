import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SmsTemplatesService } from './sms-templates.service';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../user/users.schema';
import { CurrentOrganization } from '../auth/organization.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Organization } from '../user/users.schema';

@Controller('sms-templates')
@UseGuards(JwtAuthGuard)
export class SmsTemplatesController {
  constructor(private readonly smsTemplatesService: SmsTemplatesService) {}

  @Get()
  async findAll(
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.isPartner ? user.userId : undefined;
    const userId =
      !user.isPartner &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.CHINA_STAFF ||
        user.role === UserRole.GHANA_STAFF)
        ? user.userId
        : undefined;
    return this.smsTemplatesService.findAll(organization, partnerId, userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.isPartner ? user.userId : undefined;
    const userId =
      !user.isPartner &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.CHINA_STAFF ||
        user.role === UserRole.GHANA_STAFF)
        ? user.userId
        : undefined;
    return this.smsTemplatesService.findOne(
      id,
      organization,
      partnerId,
      userId,
    );
  }

  @Post()
  async create(
    @Body() dto: CreateSmsTemplateDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.isPartner ? user.userId : undefined;
    const userId =
      !user.isPartner &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.CHINA_STAFF ||
        user.role === UserRole.GHANA_STAFF)
        ? user.userId
        : undefined;

    // Only admins can create default templates
    if (dto.isDefault && user.role !== UserRole.ADMIN) {
      dto.isDefault = false;
    }

    return this.smsTemplatesService.create(
      dto,
      organization,
      partnerId,
      userId,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSmsTemplateDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.isPartner ? user.userId : undefined;
    const userId =
      !user.isPartner &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.CHINA_STAFF ||
        user.role === UserRole.GHANA_STAFF)
        ? user.userId
        : undefined;
    return this.smsTemplatesService.update(
      id,
      dto,
      organization,
      partnerId,
      userId,
    );
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.isPartner ? user.userId : undefined;
    const userId =
      !user.isPartner &&
      (user.role === UserRole.ADMIN ||
        user.role === UserRole.CHINA_STAFF ||
        user.role === UserRole.GHANA_STAFF)
        ? user.userId
        : undefined;
    await this.smsTemplatesService.delete(id, organization, partnerId, userId);
    return { message: 'Template deleted successfully' };
  }
}
