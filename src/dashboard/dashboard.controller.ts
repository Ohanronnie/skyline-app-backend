import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async stats() {
    return this.dashboardService.stats();
  }

  @Get('activity')
  async activity() {
    return this.dashboardService.activity();
  }

  @Get('insights')
  async insights() {
    return this.dashboardService.insights();
  }
}
