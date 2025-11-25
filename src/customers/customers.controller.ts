import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CurrentOrganization } from '../auth/organization.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Organization } from '../user/users.schema';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.role === 'partner' ? user.userId : undefined;
    return this.customersService.findAll(organization, partnerId);
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.search(q ?? '', organization);
  }

  @Post()
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId = user.role === 'partner' ? user.userId : undefined;
    return this.customersService.create(dto, organization, partnerId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.findOne(id, organization);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.update(id, dto, organization);
  }

  @Get(':id/shipments')
  async shipments(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.shipments(id, organization);
  }
}
