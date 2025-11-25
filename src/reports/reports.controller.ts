import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/users.schema';
import { ExportReportDto } from './dto/export-report.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('shipments')
  async shipments() {
    return this.reportsService.shipmentsAnalytics();
  }

  @Get('containers')
  async containers() {
    return this.reportsService.containersPerformance();
  }

  @Roles(UserRole.ADMIN)
  @Get('financial')
  async financial() {
    return this.reportsService.financialReports();
  }

  @Get('warehouse')
  async warehouse() {
    return this.reportsService.warehouseOperations();
  }

  @Post('export')
  async export(@Body() dto: ExportReportDto) {
    return this.reportsService.exportReport(dto);
  }
}
