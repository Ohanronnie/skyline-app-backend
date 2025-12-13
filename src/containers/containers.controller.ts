import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { LoadShipmentsDto } from './dto/load-shipments.dto';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Organization } from '../user/users.schema';
import { CurrentOrganization } from '../auth/organization.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('containers')
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Get()
  async findAll(
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const isPartner = user.isPartner || user.role === 'partner';
    const partnerId = isPartner ? user.userId : undefined;
    const containers = await this.containersService.findAll(
      organization,
      partnerId,
    );

    // Transform for partners: use partnerCustomerId as customerId for frontend compatibility
    if (isPartner) {
      return containers.map((container: any) => {
        // Partners only see their own customer, not admin's customer
        container.customerId = container.partnerCustomerId || undefined;
        return container;
      });
    }

    return containers;
  }

  @Roles(UserRole.ADMIN, UserRole.CHINA_STAFF)
  @Post()
  async create(
    @Body() dto: CreateContainerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Automatically assign partnerId if user is a partner and not already set
    if (!dto.partnerId && (user.isPartner || user.role === 'partner')) {
      dto.partnerId = user.userId;
    }
    return this.containersService.create(dto, organization);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const container = await this.containersService.findOne(id, organization);

    // Transform for partners: use partnerCustomerId as customerId for frontend compatibility
    const isPartner = user.isPartner || user.role === 'partner';
    if (isPartner) {
      // Partners only see their own customer, not admin's customer
      container.customerId = container.partnerCustomerId || undefined;
    }

    return container;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContainerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Determine user role - partners have isPartner flag
    const userRole = user.isPartner ? 'partner' : user.role;
    return this.containersService.update(
      id,
      dto,
      organization,
      userRole,
      user.userId,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.CHINA_STAFF)
  @Post(':id/load')
  async load(
    @Param('id') id: string,
    @Body() dto: LoadShipmentsDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.containersService.loadShipments(id, dto, organization);
  }

  @Get(':id/shipments')
  async listShipments(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.containersService.listShipments(id, organization);
  }

  @Put(':id/assign-customer')
  async assignCustomer(
    @Param('id') id: string,
    @Body() dto: AssignCustomerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    // Determine user role - partners have isPartner flag
    const userRole = user.isPartner ? 'partner' : user.role;
    return this.containersService.assignCustomer(
      id,
      dto.customerId || null,
      organization,
      userRole,
      user.userId,
    );
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    await this.containersService.delete(id, organization);
    return { message: 'Container deleted successfully' };
  }
}
