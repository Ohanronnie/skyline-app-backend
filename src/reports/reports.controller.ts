import { Body, Controller, Get, Post, UseGuards, Res, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole, Organization } from '../user/users.schema';
import { ExportReportDto } from './dto/export-report.dto';
import { GenerateExcelReportDto } from './dto/generate-excel-report.dto';
import { CurrentOrganization } from '../auth/organization.decorator';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('shipments')
  async shipments(@CurrentOrganization() organization: Organization) {
    return this.reportsService.shipmentsAnalytics(organization);
  }

  @Get('containers')
  async containers(@CurrentOrganization() organization: Organization) {
    return this.reportsService.containersPerformance(organization);
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

  @Post('export-excel')
  async exportExcel(
    @Body() dto: GenerateExcelReportDto,
    @Query('status') status: string | string[] | undefined,
    @CurrentOrganization() organization: Organization,
    @Res() res: Response,
  ) {
    // Merge status from query param into dto if provided
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      dto.shipmentStatuses = [
        ...(dto.shipmentStatuses || []),
        ...statusArray,
      ] as any;
    }
    console.log(dto);

    const buffer = await this.reportsService.exportExcel(dto, organization);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${Date.now()}.xlsx"`,
    );
    return res.send(buffer);
  }
}
