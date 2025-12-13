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

    const isPartner = user.isPartner || user.role === 'partner';
    const partnerId = isPartner ? user.userId : undefined;
    const customerId =
      user.isCustomer || user.role === 'customer' ? user.userId : undefined;
    const shipments = await this.shipmentsService.findAll(
      organization,
      warehouseIds,
      partnerId,
      customerId,
    );

    // Transform for partners: use partnerCustomerId as customerId for frontend compatibility
    if (isPartner) {
      return shipments.map((shipment) => {
        const s = shipment.toObject();
        // Partners only see their own customer, not admin's customer
        s.customerId = s.partnerCustomerId || undefined;
        return s;
      });
    }

    return shipments;
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
    @CurrentUser() user: any,
  ) {
    const shipment = await this.shipmentsService.findOne(id, organization);

    // Transform for partners: use partnerCustomerId as customerId for frontend compatibility
    const isPartner = user.isPartner || user.role === 'partner';
    if (isPartner) {
      const s = shipment.toObject();
      // Partners only see their own customer, not admin's customer
      s.customerId = s.partnerCustomerId || undefined;
      return s;
    }

    return shipment;
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
