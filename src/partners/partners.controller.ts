import { Body, Controller, Post, UseGuards, Get, Request } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { Organization } from '../user/users.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/users.schema';
import { PartnerLoginDto } from './dto/partner-login.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CurrentOrganization } from '../auth/organization.decorator';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('auth/login')
  async login(@Body() dto: PartnerLoginDto) {
    return this.partnersService.login(dto.phoneNumber, dto.otp, dto.organization);
  }

  @Post('auth/otp')
  async sendOtp(@Body('phoneNumber') phoneNumber: string) {
    return this.partnersService.sendOtp(phoneNumber);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@CurrentOrganization() organization: Organization) {
    return this.partnersService.findAll(organization);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreatePartnerDto) {
    return this.partnersService.create(dto.name, dto.phoneNumber, dto.organization);
  }
}
