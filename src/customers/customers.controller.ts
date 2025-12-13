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
import { Throttle } from '@nestjs/throttler';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerSendOtpDto } from './dto/customer-send-otp.dto';
import { CurrentOrganization } from '../auth/organization.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Organization } from '../user/users.schema';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/login')
  async login(@Body() dto: CustomerLoginDto) {
    return this.customersService.login(
      dto.phoneNumber,
      dto.otp,
      dto.organization,
    );
  }

  @Post('auth/otp')
  async sendOtp(@Body() dto: CustomerSendOtpDto) {
    return this.customersService.sendOtp(dto.phoneNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.customersService.findById(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId =
      user.isPartner || user.role === 'partner' ? user.userId : undefined;
    return this.customersService.findAll(organization, partnerId);
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.search(q ?? '', organization);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId =
      user.isPartner || user.role === 'partner' ? user.userId : undefined;
    return this.customersService.create(dto, organization, partnerId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
  ) {
    return this.customersService.findOne(id, organization);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    const partnerId =
      user.isPartner || user.role === 'partner' ? user.userId : undefined;
    return this.customersService.update(id, dto, organization, partnerId);
  }

  @Get(':id/shipments')
  @UseGuards(JwtAuthGuard)
  async shipments(
    @Param('id') id: string,
    @CurrentOrganization() organization: Organization,
    @CurrentUser() user: any,
  ) {
    console.log(user);
    return this.customersService.shipments(id, organization);
  }
}
