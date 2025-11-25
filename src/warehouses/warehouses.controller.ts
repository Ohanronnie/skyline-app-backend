import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Organization } from '../user/users.schema';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CurrentOrganization } from '../auth/organization.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  async findAll(@CurrentOrganization() organization: Organization) {
    return this.warehousesService.findAll(organization);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateWarehouseDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.warehousesService.create(dto, organization);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.warehousesService.findOne(id, organization);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.warehousesService.update(id, dto, organization);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    await this.warehousesService.delete(id, organization);
    return { message: 'Warehouse deleted successfully' };
  }

  @Get(':id/inventory')
  async inventory(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.warehousesService.inventory(id, organization);
  }
}
