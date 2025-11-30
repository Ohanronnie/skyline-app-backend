import {
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Body,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentOrganization } from '../auth/organization.decorator';
import { LocationFilterService } from '../auth/location-filter.service';
import type { UserContext } from '../auth/location-filter.service';
import { Organization } from '../user/users.schema';

@UseGuards(JwtAuthGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly locationFilter: LocationFilterService,
  ) {}

  @Get()
  async findAll(
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Location-based filtering
    const warehouseIds =
      await this.locationFilter.getAccessibleWarehouseIds(user);

    const partnerId =
      user.isPartner || user.role === 'partner' ? user.userId : undefined;
    const customerId =
      user.isCustomer || user.role === 'customer' ? user.userId : undefined;
    return this.shipmentsService.findAll(
      organization,
      warehouseIds,
      partnerId,
      customerId,
    );
  }

  @Post()
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Automatically assign partnerId if user is a partner and not already set
    if (!dto.partnerId && (user.isPartner || user.role === 'partner')) {
      dto.partnerId = user.userId;
    }
    return this.shipmentsService.create(dto, organization);
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.shipmentsService.search(q ?? '', organization);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.shipmentsService.findOne(id, organization);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Determine user role - partners have isPartner flag
    const userRole = user.isPartner ? 'partner' : user.role;
    return this.shipmentsService.update(
      id,
      dto,
      organization,
      userRole,
      user.userId,
    );
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    await this.shipmentsService.delete(id, organization);
    return { message: 'Shipment deleted successfully' };
  }
}
