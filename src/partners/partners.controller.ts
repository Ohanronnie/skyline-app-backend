import {
  Body,
  Controller,
  Post,
  UseGuards,
  Get,
  Req,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PartnersService } from './partners.service';
import { Organization } from '../user/users.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/users.schema';
import { PartnerLoginDto } from './dto/partner-login.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { CurrentOrganization } from '../auth/organization.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtRefreshAuthGuard } from '../auth/guards/jwt-refresh.guard';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/login')
  async login(@Body() dto: PartnerLoginDto) {
    return this.partnersService.login(
      dto.phoneNumber,
      dto.otp,
      dto.organization,
    );
  }

  @Post('auth/otp')
  async sendOtp(@Body('phoneNumber') phoneNumber: string) {
    return this.partnersService.sendOtp(phoneNumber);
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtRefreshAuthGuard)
  @Post('auth/refresh')
  async refresh(@Req() req: any) {
    const { userId, refreshToken } = req.user;
    return this.partnersService.refresh(userId, refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    // Only partners should hit this; JWT payload has `userId` and `isPartner`
    return this.partnersService.findById(user.userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: any, @Body() dto: UpdatePartnerDto) {
    // Only partners can update their own details
    return this.partnersService.update(user.userId, dto);
  }

  @Get('home')
  @UseGuards(JwtAuthGuard)
  async home(@CurrentUser() user: any) {
    // Partner home dashboard data
    return this.partnersService.dashboard(user.userId);
  }

  @Get('me/customers')
  @UseGuards(JwtAuthGuard)
  async getMyCustomers(
    @CurrentUser() user: any,
    @CurrentOrganization() organization: Organization,
  ) {
    // Get current partner's customers
    return this.partnersService.getCustomers(user.userId, organization);
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
    //console.log('Creating partner', dto);
    return this.partnersService.create(
      dto.name,
      dto.phoneNumber,
      dto.organization,
      dto.email,
    );
  }
}
