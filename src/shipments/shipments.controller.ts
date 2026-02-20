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

import { PaginationDto } from '../common/dto/pagination.dto';

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
    @Query() pagination: PaginationDto,
  ) {
    // Location-based filtering
    const warehouseIds =
      await this.locationFilter.getAccessibleWarehouseIds(user);

    const isPartner = user.isPartner || user.role === 'partner';
    const partnerId = isPartner ? user.userId : undefined;
    const customerId =
      user.isCustomer || user.role === 'customer' ? user.userId : undefined;
    const {
      data: shipments,
      total,
      page,
      limit,
    } = await this.shipmentsService.findAll(
      organization,
      warehouseIds,
      partnerId,
      customerId,
      pagination.paginated ? pagination.page : 1,
      pagination.paginated ? pagination.limit : 1000000,
    );

    // Transform for partners: use partnerCustomerId as customerId for frontend compatibility
    let transformedData = shipments;
    if (isPartner) {
      transformedData = shipments.map((shipment) => {
        const s = shipment.toObject();
        // Partners only see their own customer, not admin's customer
        s.customerId = s.partnerCustomerId || undefined;
        return s;
      }) as any;
    }

    if (!pagination.paginated) {
      return transformedData;
    }

    return {
      data: transformedData,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
  }

  @Get('tracking-summary')
  async getTrackingSummary(@CurrentOrganization() organization: Organization) {
    return this.shipmentsService.getTrackingSummary(organization);
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
    @Query() pagination: PaginationDto,
    @CurrentOrganization() organization: Organization,
  ) {
    const { data, total, page, limit } = await this.shipmentsService.search(
      q ?? '',
      organization,
      pagination.paginated ? pagination.page : 1,
      pagination.paginated ? pagination.limit : 1000000,
    );

    if (!pagination.paginated) {
      return data;
    }

    return {
      data,
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    };
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
