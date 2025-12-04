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
import { CargoService } from './cargo.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentOrganization } from '../auth/organization.decorator';
import { Organization, UserRole } from '../user/users.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @Get()
  async findAll(@CurrentOrganization() organization: Organization) {
    return this.cargoService.findAll(organization);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.cargoService.findOneWithPackages(id, organization);
  }

  @Roles(UserRole.ADMIN, UserRole.CHINA_STAFF)
  @Post()
  async create(
    @Body() dto: CreateCargoDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.cargoService.create(dto, organization);
  }

  @Roles(UserRole.ADMIN, UserRole.CHINA_STAFF)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCargoDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.cargoService.update(id, dto, organization);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    await this.cargoService.delete(id, organization);
    return { message: 'Cargo deleted successfully' };
  }
}
