import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Shipment,
  ShipmentDocument,
  ShipmentStatus,
} from '../shipments/shipments.schema';
import {
  Container,
  ContainerDocument,
  ContainerStatus,
} from '../containers/containers.schema';
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { Partner, PartnerDocument } from '../partners/partners.schema';
import {
  GenerateExcelReportDto,
  ReportMode,
  ReportType,
} from './dto/generate-excel-report.dto';
import { Organization } from '../user/users.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';
import ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly matchSourcePriority = new Map<string, number>([
    ['Primary', 4],
    ['Partner-Specific', 3],
    ['Partner Assignment', 2],
    ['Array (Multiple)', 1],
  ]);

  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
  ) {}

  async shipmentsAnalytics(organization: Organization) {
    const filter = buildOrganizationFilter(organization);
    const total = await this.shipmentModel.countDocuments(filter);
    const byStatus = await this.shipmentModel.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { total, byStatus };
  }

  async containersPerformance(organization: Organization) {
    const filter = buildOrganizationFilter(organization);
    const total = await this.containerModel.countDocuments(filter);
    const active = await this.containerModel.countDocuments({
      ...filter,
      status: {
        $in: [
          ContainerStatus.LOADING,
          ContainerStatus.LOADED,
          ContainerStatus.IN_TRANSIT,
        ],
      },
    });
    const byStatus = await this.containerModel.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { total, active, byStatus };
  }

  async financialReports() {
    // Placeholder: in real app, compute revenues/costs
    return { revenue: 0, costs: 0, profit: 0 };
  }

  async warehouseOperations() {
    // Placeholder: add warehouse KPIs later
    return { throughput: 0, occupancyRate: 0 };
  }

  async exportReport(payload: any) {
    // Placeholder export - return CSV/JSON selection
    return { export: 'ok', type: payload?.type ?? 'json' };
  }

  async exportExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    this.logger.log(
      `[exportExcel] Starting export - type: ${dto.type}, mode: ${dto.mode}`,
    );
    this.logger.log(`[exportExcel] DTO: ${JSON.stringify(dto)}`);
    this.logger.log(
      `[exportExcel] Organization: ${organization || 'not provided'}`,
    );

    switch (dto.type) {
      case ReportType.SHIPMENTS:
        return this.generateShipmentsExcel(dto, organization);
      case ReportType.CUSTOMERS:
        return this.generateCustomersExcel(dto, organization);
      case ReportType.CONTAINERS:
        return this.generateContainersExcel(dto, organization);
      default:
        throw new Error('Unsupported report type');
    }
  }

  async getExportData(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<any> {
    switch (dto.type) {
      case ReportType.SHIPMENTS:
        return this.getShipmentsData(dto, organization);
      case ReportType.CUSTOMERS:
        return this.getCustomersData(dto, organization);
      case ReportType.CONTAINERS:
        return this.getContainersData(dto, organization);
      default:
        throw new Error('Unsupported report type');
    }
  }

  private parseDateRange(dto: GenerateExcelReportDto) {
    let from: Date | undefined;
    let to: Date | undefined;
    if (dto.fromDate) from = new Date(dto.fromDate);
    if (dto.toDate) {
      const d = new Date(dto.toDate);
      // Include whole day
      d.setHours(23, 59, 59, 999);
      to = d;
    }
    return { from, to };
  }

  private getReferenceId(value: any): string | undefined {
    if (!value) return undefined;
    const rawId = value._id ?? value.id ?? value;
    if (!rawId) return undefined;
    return typeof rawId === 'string' ? rawId : rawId.toString();
  }

  private formatLabel(value?: string | null): string {
    if (!value) return 'All';
    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date);
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private buildFilterSummary(dto: GenerateExcelReportDto): string {
    const filters: string[] = [];

    if (dto.fromDate || dto.toDate) {
      filters.push(
        `Date: ${dto.fromDate ? this.formatDate(dto.fromDate) : 'Start'} - ${dto.toDate ? this.formatDate(dto.toDate) : 'Now'}`,
      );
    }
    if (dto.shipmentStatuses?.length) {
      filters.push(
        `Shipment Status: ${dto.shipmentStatuses.map((status) => this.formatLabel(status)).join(', ')}`,
      );
    }
    if (dto.customerTypes?.length) {
      filters.push(
        `Customer Type: ${dto.customerTypes.map((type) => this.formatLabel(type)).join(', ')}`,
      );
    }
    if (dto.locations?.length) {
      filters.push(
        `Location: ${dto.locations.map((location) => this.formatLabel(location)).join(', ')}`,
      );
    }
    if (dto.partnerId) filters.push(`Partner ID: ${dto.partnerId}`);
    if (dto.customerId) filters.push(`Customer ID: ${dto.customerId}`);
    if (dto.containerId) filters.push(`Container ID: ${dto.containerId}`);
    if (dto.onlyWithShipments) filters.push('Only Customers With Shipments');

    return filters.length ? filters.join(' | ') : 'No filters applied';
  }

  private addReportHeader(
    sheet: ExcelJS.Worksheet,
    title: string,
    dto: GenerateExcelReportDto,
    organization: Organization | undefined,
    columnCount: number,
  ) {
    sheet.addRow([title]);
    if (columnCount > 1) {
      sheet.mergeCells(1, 1, 1, columnCount);
    }

    sheet.addRow(['Generated At', this.formatDateTime(new Date())]);
    sheet.addRow(['Mode', this.formatLabel(dto.mode)]);
    sheet.addRow(['Organization', organization ? this.formatLabel(organization) : 'All']);
    sheet.addRow(['Filters', this.buildFilterSummary(dto)]);
    sheet.addRow([]);

    const titleRow = sheet.getRow(1);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
    titleRow.alignment = { horizontal: 'left' };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5EEF7' },
    };

    for (let rowNumber = 2; rowNumber <= 5; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.getCell(1).font = { bold: true, color: { argb: 'FF374151' } };
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    }
  }

  private styleSectionRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: 'FF0F172A' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  }

  private styleTableHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
    const row = sheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    };
    row.alignment = { vertical: 'middle', horizontal: 'left' };
  }

  private finalizeSheet(
    sheet: ExcelJS.Worksheet,
    options: {
      freezeAtRow?: number;
      zebraFromRow?: number;
      numberColumns?: number[];
    } = {},
  ) {
    const lastColumn = sheet.columnCount || 1;

    sheet.views = [
      {
        state: 'frozen',
        ySplit: options.freezeAtRow ?? 0,
      },
    ];

    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true,
        };
      });

      if (
        options.zebraFromRow &&
        rowNumber >= options.zebraFromRow &&
        (rowNumber - options.zebraFromRow) % 2 === 1
      ) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        });
      }
    }

    for (const columnIndex of options.numberColumns || []) {
      sheet.getColumn(columnIndex).numFmt = '#,##0.000';
    }

    for (let columnIndex = 1; columnIndex <= lastColumn; columnIndex += 1) {
      const column = sheet.getColumn(columnIndex);
      let maxLength = 12;

      column.eachCell({ includeEmpty: true }, (cell) => {
        const rawValue = cell.value;
        let cellText = '';
        if (rawValue === null || rawValue === undefined) {
          cellText = '';
        } else if (typeof rawValue === 'object' && 'richText' in (rawValue as any)) {
          cellText = (rawValue as any).richText.map((part: any) => part.text).join('');
        } else {
          cellText = String(rawValue);
        }
        maxLength = Math.max(maxLength, Math.min(cellText.length + 2, 36));
      });

      column.width = maxLength;
    }
  }

  private setCustomerMatchSource(
    matches: Map<string, string>,
    customerId: string | undefined,
    source: string,
  ) {
    if (!customerId) return;
    const existing = matches.get(customerId);
    const nextPriority = this.matchSourcePriority.get(source) ?? 0;
    const existingPriority = existing
      ? this.matchSourcePriority.get(existing) ?? 0
      : 0;

    if (!existing || nextPriority > existingPriority) {
      matches.set(customerId, source);
    }
  }

  private stringifiedArrayExpression(path: string, field?: string) {
    return {
      $map: {
        input: { $ifNull: [`$${path}`, []] },
        as: 'item',
        in: field
          ? { $toString: `$$item.${field}` }
          : { $toString: '$$item' },
      },
    };
  }

  private createReferenceMatchStage(
    ids: string[],
    options: {
      scalar?: string[];
      array?: string[];
      nestedArray?: Array<{ path: string; field: string }>;
    },
  ) {
    if (!ids.length) {
      return { $match: { _id: { $exists: false } } };
    }

    const conditions: any[] = [];

    for (const path of options.scalar || []) {
      conditions.push({
        $in: [{ $toString: `$${path}` }, ids],
      });
    }

    for (const path of options.array || []) {
      conditions.push({
        $gt: [
          {
            $size: {
              $setIntersection: [this.stringifiedArrayExpression(path), ids],
            },
          },
          0,
        ],
      });
    }

    for (const item of options.nestedArray || []) {
      conditions.push({
        $gt: [
          {
            $size: {
              $setIntersection: [
                this.stringifiedArrayExpression(item.path, item.field),
                ids,
              ],
            },
          },
          0,
        ],
      });
    }

    if (!conditions.length) {
      return { $match: { _id: { $exists: false } } };
    }

    return {
      $match: {
        $expr: {
          $or: conditions,
        },
      },
    };
  }

  private buildShipmentPipeline(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ) {
    const dateQuery = this.buildDateQuery(dto, 'createdAt');
    const query: any = { ...dateQuery };
    const pipeline: any[] = [];

    if (organization) {
      Object.assign(query, buildOrganizationFilter(organization));
    }

    if (dto.shipmentStatuses?.length) {
      query.status = { $in: dto.shipmentStatuses };
    }

    if (Object.keys(query).length > 0) {
      pipeline.push({ $match: query });
    }

    if (dto.partnerId) {
      pipeline.push(
        this.createReferenceMatchStage([dto.partnerId], {
          scalar: ['partnerId'],
          array: ['partnerIds'],
          nestedArray: [{ path: 'partnerAssignments', field: 'partnerId' }],
        }),
      );
    }

    if (dto.customerId) {
      pipeline.push(
        this.createReferenceMatchStage([dto.customerId], {
          scalar: ['customerId', 'partnerCustomerId'],
          array: ['customerIds'],
          nestedArray: [{ path: 'partnerAssignments', field: 'customerId' }],
        }),
      );
    }

    if (dto.containerId) {
      pipeline.push(
        this.createReferenceMatchStage([dto.containerId], {
          scalar: ['containerId'],
        }),
      );
    }

    const payload = (dto as any).payload;
    if (payload?.selectedShipments?.length) {
      pipeline.push(
        this.createReferenceMatchStage(payload.selectedShipments, {
          scalar: ['_id'],
        }),
      );
    }

    return pipeline;
  }

  private buildDateQuery(
    dto: GenerateExcelReportDto,
    field: string = 'createdAt',
  ) {
    const { from, to } = this.parseDateRange(dto);
    if (!from && !to) return {};
    const query: any = {};
    query[field] = {};
    if (from) query[field].$gte = from;
    if (to) query[field].$lte = to;
    return query;
  }

  private async getShipmentsData(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ) {
    const shipments = await this.shipmentModel
      .aggregate([...this.buildShipmentPipeline(dto, organization), { $sort: { createdAt: -1 } }])
      .exec();

    return this.shipmentModel.populate(shipments, [
      { path: 'customerId', select: 'name phone email location' },
      { path: 'customerIds', select: 'name phone email location' },
      { path: 'partnerId', select: 'name phoneNumber' },
      { path: 'partnerCustomerId', select: 'name phone email location' },
      {
        path: 'partnerAssignments.customerId',
        select: 'name phone email location',
      },
      { path: 'containerId', select: 'containerNumber' },
    ]);
  }

  private async getShipmentsForCustomerIds(
    customerIds: string[],
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ) {
    const shipments = await this.shipmentModel
      .aggregate([
        ...this.buildShipmentPipeline(
          { ...dto, customerId: undefined, containerId: undefined },
          organization,
        ),
        this.createReferenceMatchStage(customerIds, {
          scalar: ['customerId', 'partnerCustomerId'],
          array: ['customerIds'],
          nestedArray: [{ path: 'partnerAssignments', field: 'customerId' }],
        }),
        { $sort: { createdAt: -1 } },
      ])
      .exec();

    return this.shipmentModel.populate(shipments, [
      { path: 'containerId', select: 'containerNumber' },
    ]);
  }

  private async generateShipmentsExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    this.logger.log(`[generateShipmentsExcel] Starting - mode: ${dto.mode}`);

    const shipments = await this.getShipmentsData(dto, organization);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Shipments');
    const detailedColumns = 15;
    const summaryColumns = 3;

    this.addReportHeader(
      sheet,
      'Shipment Report',
      dto,
      organization,
      dto.mode === ReportMode.DETAILED ? detailedColumns : summaryColumns,
    );

    if (dto.mode === ReportMode.SUMMARY) {
      const totalShipments = shipments.length;
      const totalCbm = shipments.reduce((sum, s) => sum + (s.cbm || 0), 0);

      sheet.addRow(['Summary']);
      this.styleSectionRow(sheet, sheet.rowCount);
      sheet.addRow(['Total Shipments', totalShipments]);
      sheet.addRow(['Total CBM', totalCbm.toFixed(3)]);
      sheet.addRow([]);

      sheet.addRow(['Per Customer']);
      this.styleSectionRow(sheet, sheet.rowCount);
      sheet.addRow(['Customer Name', 'Shipments', 'Total CBM']);
      const customerHeaderRow = sheet.rowCount;
      this.styleTableHeaderRow(sheet, customerHeaderRow);
      const byCustomer = new Map<
        string,
        { name: string; count: number; cbm: number }
      >();
      for (const s of shipments) {
        // Collect all related customer IDs and names for summary
        const relatedCustomers = new Set<string>();
        const primaryCustomerId = this.getReferenceId(s.customerId);
        if (primaryCustomerId) relatedCustomers.add(primaryCustomerId);
        const partnerCustomerId = this.getReferenceId(s.partnerCustomerId);
        if (partnerCustomerId) relatedCustomers.add(partnerCustomerId);
        if (s.customerIds)
          s.customerIds.forEach((id: any) => {
            const customerId = this.getReferenceId(id);
            if (customerId) relatedCustomers.add(customerId);
          });
        if (s.partnerAssignments)
          s.partnerAssignments.forEach((a: any) => {
            const customerId = this.getReferenceId(a.customerId);
            if (customerId) relatedCustomers.add(customerId);
          });

        if (relatedCustomers.size === 0) continue;

        for (const key of relatedCustomers) {
          // Find the customer object for name
          let name = 'Unknown';
          // Find the customer object for name. Handle both populated objects and raw IDs.
          const c: any =
            [
              s.customerId,
              s.partnerCustomerId,
              ...(s.customerIds || []),
              ...(s.partnerAssignments || []).map((a: any) => a.customerId),
            ].find((cust: any) => {
              if (!cust) return false;
              const custId = this.getReferenceId(cust);
              return custId === key;
            }) || key;

          name = (c as any).name || `Unknown (${key})`;

          const entry = byCustomer.get(key) || {
            name,
            count: 0,
            cbm: 0,
          };
          entry.count += 1;
          entry.cbm += s.cbm || 0;
          byCustomer.set(key, entry);
        }
      }
      const rankedCustomers = [...byCustomer.values()].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return right.cbm - left.cbm;
      });
      for (const entry of rankedCustomers) {
        sheet.addRow([entry.name, entry.count, entry.cbm.toFixed(3)]);
      }

      this.finalizeSheet(sheet, {
        zebraFromRow: customerHeaderRow + 1,
        numberColumns: [3],
      });
    } else {
      sheet.addRow([
        'Tracking Number',
        'Status',
        'CBM',
        'Customer Name',
        'Customer Phone',
        'Customer Email',
        'Customer Location',
        'Partner Name',
        'Partner Phone',
        'Partner Customer Name',
        'Partner Customer Phone',
        'Container Number',
        'Description',
        'Created At',
        'Delivered At',
      ]);
      const headerRowNumber = sheet.rowCount;
      this.styleTableHeaderRow(sheet, headerRowNumber);
      for (const s of shipments) {
        const c: any = s.customerId;
        const p: any = s.partnerId;
        const pc: any = (s as any).partnerCustomerId;
        const cont: any = s.containerId;
        sheet.addRow([
          s.trackingNumber,
          s.status,
          s.cbm ?? '',
          c?.name ?? '',
          c?.phone ?? '',
          c?.email ?? '',
          c?.location ?? '',
          p?.name ?? '',
          p?.phoneNumber ?? '',
          pc?.name ?? '',
          pc?.phone ?? '',
          cont?.containerNumber ?? '',
          s.description ?? '',
          this.formatDateTime((s as any).createdAt),
          this.formatDateTime(s.deliveredAt),
        ]);
      }

      this.finalizeSheet(sheet, {
        freezeAtRow: headerRowNumber,
        zebraFromRow: headerRowNumber + 1,
        numberColumns: [3],
      });
    }
    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }

  private async getCustomersData(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ) {
    const orgFilter = organization ? buildOrganizationFilter(organization) : {};
    const query: any = { ...orgFilter };
    if (dto.customerId) {
      query._id = new Types.ObjectId(dto.customerId);
    }
    if (dto.partnerId) {
      query.partnerId = new Types.ObjectId(dto.partnerId);
    }
    if (dto.customerTypes?.length) {
      query.type = { $in: dto.customerTypes };
    }
    if (dto.locations?.length) {
      query.location = { $in: dto.locations };
    }

    const customers = await this.customerModel
      .find(query)
      .populate('partnerId', 'name phoneNumber')
      .sort({ createdAt: -1 })
      .exec();

    if (dto.mode === ReportMode.SUMMARY && dto.customerId && customers.length === 1) {
      const targetCustomer = customers[0];
      const shipments = await this.shipmentModel.aggregate([
        ...this.buildShipmentPipeline(dto, organization),
        { $sort: { createdAt: -1 } },
      ]).exec();
      return { customer: targetCustomer, shipments };
    }

    if (dto.mode === ReportMode.DETAILED) {
      const shipments = await this.getShipmentsForCustomerIds(
        customers.map((c) => c._id.toString()),
        dto,
        organization,
      );

      return { customers, shipments };
    }

    return { customers };
  }

  private async generateCustomersExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    this.logger.log(`[generateCustomersExcel] DTO: ${JSON.stringify(dto)}`);
    const data = await this.getCustomersData(dto, organization);
    const customers = data.customers || [data.customer];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');
    const detailedColumns = 14;
    const summaryColumns = dto.customerId && customers.length === 1 ? 2 : 2;

    this.addReportHeader(
      sheet,
      'Customer Report',
      dto,
      organization,
      dto.mode === ReportMode.DETAILED ? detailedColumns : summaryColumns,
    );

    if (dto.mode === ReportMode.SUMMARY) {
      if (dto.customerId && customers.length === 1) {
        const targetCustomer = data.customer;
        const shipments = data.shipments || [];

        sheet.addRow(['CUSTOMER DASHBOARD']);
        this.styleSectionRow(sheet, sheet.rowCount);
        sheet.addRow(['Name', targetCustomer?.name]);
        sheet.addRow(['Type', this.formatLabel(targetCustomer?.type)]);
        sheet.addRow(['Location', this.formatLabel(targetCustomer?.location)]);
        sheet.addRow(['Email', targetCustomer?.email || 'N/A']);
        sheet.addRow(['Phone', targetCustomer?.phone || 'N/A']);
        sheet.addRow([]);

        const totalCbm = shipments.reduce(
          (s: number, ship: any) => s + (ship.cbm || 0),
          0,
        );

        sheet.addRow(['KEY METRICS']);
        this.styleSectionRow(sheet, sheet.rowCount);
        sheet.addRow(['Total Shipments', shipments.length]);
        sheet.addRow(['Total Volume (CBM)', totalCbm.toFixed(3)]);
        sheet.addRow([
          'Average CBM per Shipment',
          shipments.length ? (totalCbm / shipments.length).toFixed(3) : 0,
        ]);
        sheet.addRow([]);

        sheet.addRow(['SHIPMENT STATUS BREAKDOWN']);
        this.styleSectionRow(sheet, sheet.rowCount);
        const statusCounts = new Map<string, number>();
        shipments.forEach((s: any) =>
          statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1),
        );
        for (const [status, count] of statusCounts.entries()) {
          sheet.addRow([this.formatLabel(status), count]);
        }

        if (shipments.length > 0) {
          const dates = shipments
            .map((s: any) => (s as any).createdAt)
            .filter(Boolean)
            .sort();
          sheet.addRow([]);
          sheet.addRow(['ACTIVITY DATES']);
          this.styleSectionRow(sheet, sheet.rowCount);
          sheet.addRow([
            'First Shipment',
            this.formatDate(dates[0]),
          ]);
          sheet.addRow([
            'Latest Shipment',
            this.formatDate(dates[dates.length - 1]),
          ]);
        }

        this.finalizeSheet(sheet, {
          numberColumns: [2],
        });
      } else {
        sheet.addRow(['Summary']);
        this.styleSectionRow(sheet, sheet.rowCount);
        sheet.addRow(['Total Customers', customers.length]);
        sheet.addRow([]);
        sheet.addRow(['By Type']);
        this.styleSectionRow(sheet, sheet.rowCount);
        sheet.addRow(['Customer Type', 'Count']);
        const typeHeaderRow = sheet.rowCount;
        this.styleTableHeaderRow(sheet, typeHeaderRow);
        const byType = new Map<string, number>();
        customers.forEach((c) =>
          byType.set(c.type, (byType.get(c.type) || 0) + 1),
        );
        [...byType.entries()]
          .sort((left, right) => right[1] - left[1])
          .forEach(([type, count]) =>
            sheet.addRow([this.formatLabel(type), count]),
          );

        sheet.addRow([]);
        sheet.addRow(['By Location']);
        this.styleSectionRow(sheet, sheet.rowCount);
        sheet.addRow(['Location', 'Count']);
        const locationHeaderRow = sheet.rowCount;
        this.styleTableHeaderRow(sheet, locationHeaderRow);
        const byLocation = new Map<string, number>();
        customers.forEach((c) =>
          byLocation.set(c.location, (byLocation.get(c.location) || 0) + 1),
        );
        [...byLocation.entries()]
          .sort((left, right) => right[1] - left[1])
          .forEach(([location, count]) =>
            sheet.addRow([this.formatLabel(location), count]),
          );

        this.finalizeSheet(sheet, {
          zebraFromRow: typeHeaderRow + 1,
        });
      }
    } else {
      sheet.addRow([
        'Customer Name',
        'Customer Type',
        'Customer Location',
        'Customer Email',
        'Customer Phone',
        'Customer Address',
        'Partner Name',
        'Partner Phone',
        'Shipment Tracking',
        'Shipment Status',
        'Customer Link Type',
        'Container Number',
        'CBM',
        'Total Shipments (Lifetime)',
      ]);
      const headerRowNumber = sheet.rowCount;
      this.styleTableHeaderRow(sheet, headerRowNumber);
      const shipments = data.shipments || [];

      const shipmentsByCustomer = new Map<
        string,
        Array<{ shipment: ShipmentDocument; source: string }>
      >();
      shipments.forEach((s: any) => {
        const idToSource = new Map<string, string>();
        const primaryCustomerId = this.getReferenceId(s.customerId);
        this.setCustomerMatchSource(idToSource, primaryCustomerId, 'Primary');
        const partnerCustomerId = this.getReferenceId(s.partnerCustomerId);
        this.setCustomerMatchSource(
          idToSource,
          partnerCustomerId,
          'Partner-Specific',
        );
        if (s.customerIds)
          s.customerIds.forEach((id: any) => {
            const customerId = this.getReferenceId(id);
            this.setCustomerMatchSource(
              idToSource,
              customerId,
              'Array (Multiple)',
            );
          });
        if (s.partnerAssignments)
          s.partnerAssignments.forEach((a: any) => {
            const customerId = this.getReferenceId(a.customerId);
            this.setCustomerMatchSource(
              idToSource,
              customerId,
              'Partner Assignment',
            );
          });

        idToSource.forEach((source, id) => {
          const entries = shipmentsByCustomer.get(id) || [];
          entries.push({ shipment: s, source });
          shipmentsByCustomer.set(id, entries);
        });
      });

      for (const c of customers) {
        const p: any = c.partnerId;
        const cShips = shipmentsByCustomer.get(c._id.toString()) || [];
        if (dto.onlyWithShipments && cShips.length === 0) continue;

        if (cShips.length === 0) {
          sheet.addRow([
            c.name,
            this.formatLabel(c.type),
            this.formatLabel(c.location),
            c.email || '',
            c.phone || '',
            c.address || '',
            p?.name || '',
            p?.phoneNumber || '',
            'N/A',
            'N/A',
            'N/A',
            'N/A',
            0,
            0,
          ]);
        } else {
          for (const entry of cShips) {
            const s = entry.shipment;
            const cont: any = s.containerId;
            sheet.addRow([
              c.name,
              this.formatLabel(c.type),
              this.formatLabel(c.location),
              c.email || '',
              c.phone || '',
              c.address || '',
              p?.name || '',
              p?.phoneNumber || '',
              s.trackingNumber,
              s.status,
              entry.source,
              cont?.containerNumber || 'Not Loaded',
              s.cbm || 0,
              cShips.length,
            ]);
          }
        }
      }

      this.finalizeSheet(sheet, {
        freezeAtRow: headerRowNumber,
        zebraFromRow: headerRowNumber + 1,
        numberColumns: [13],
      });
    }
    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }

  private async getContainersData(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ) {
    const orgFilter = organization ? buildOrganizationFilter(organization) : {};
    const containerQuery: any = { ...orgFilter };
    if (dto.containerId)
      containerQuery._id = new Types.ObjectId(dto.containerId);

    const containers = await this.containerModel
      .find(containerQuery)
      .sort({ createdAt: -1 })
      .exec();

    const containerIds = containers.map((c) => c._id.toString());
    const shipmentPipeline = [
      ...this.buildShipmentPipeline(
        { ...dto, containerId: undefined },
        organization,
      ),
      this.createReferenceMatchStage(containerIds, {
        scalar: ['containerId'],
      }),
    ];

    if (dto.mode === ReportMode.SUMMARY) {
      const shipmentCounts = await this.shipmentModel
        .aggregate([
          ...shipmentPipeline,
          { $addFields: { normalizedContainerId: { $toString: '$containerId' } } },
          { $group: { _id: '$normalizedContainerId', count: { $sum: 1 } } },
        ])
        .exec();
      return { containers, shipmentCounts };
    }

    const shipments = await this.shipmentModel
      .aggregate([...shipmentPipeline, { $sort: { createdAt: -1 } }])
      .exec();
    const populatedShipments = await this.shipmentModel.populate(shipments, [
      { path: 'customerId', select: 'name phone' },
      { path: 'partnerId', select: 'name phoneNumber' },
      { path: 'partnerCustomerId', select: 'name phone' },
    ]);
    return { containers, shipments: populatedShipments };
  }

  private async generateContainersExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    const data = await this.getContainersData(dto, organization);
    const containers = data.containers;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Containers');
    const detailedColumns = 9;
    const summaryColumns = 3;

    this.addReportHeader(
      sheet,
      'Container Report',
      dto,
      organization,
      dto.mode === ReportMode.DETAILED ? detailedColumns : summaryColumns,
    );

    if (dto.mode === ReportMode.SUMMARY) {
      sheet.addRow(['Container Number', 'Status', 'Total Shipments']);
      const headerRowNumber = sheet.rowCount;
      this.styleTableHeaderRow(sheet, headerRowNumber);
      const counts = data.shipmentCounts || [];
      const countMap = new Map(
        counts.map((item: any) => [
          item._id?.toString(),
          item.count,
        ]),
      );

      for (const c of containers) {
        const count = countMap.get(c._id.toString()) || 0;
        sheet.addRow([c.containerNumber, this.formatLabel(c.status), count]);
      }

      this.finalizeSheet(sheet, {
        freezeAtRow: headerRowNumber,
        zebraFromRow: headerRowNumber + 1,
      });
    } else {
      sheet.addRow([
        'Container Number',
        'Container Status',
        'Shipment Tracking',
        'Shipment Status',
        'Customer Name',
        'Customer Phone',
        'Partner Name',
        'Partner Phone',
        'CBM',
      ]);
      const headerRowNumber = sheet.rowCount;
      this.styleTableHeaderRow(sheet, headerRowNumber);
      const shipments = data.shipments || [];
      const shipsByContainer = new Map<string, ShipmentDocument[]>();
      shipments.forEach((s) => {
        const key = this.getReferenceId(s.containerId) || 'unknown';
        const arr = shipsByContainer.get(key) || [];
        arr.push(s);
        shipsByContainer.set(key, arr);
      });

      for (const c of containers) {
        const list = shipsByContainer.get(c._id.toString()) || [];
        if (list.length === 0) {
          sheet.addRow([
            c.containerNumber,
            this.formatLabel(c.status),
            ...Array(7).fill(''),
          ]);
        } else {
          for (const s of list) {
            const cust: any = s.customerId;
            const part: any = s.partnerId;
            sheet.addRow([
              c.containerNumber,
              this.formatLabel(c.status),
              s.trackingNumber,
              this.formatLabel(s.status),
              cust?.name || '',
              cust?.phone || '',
              part?.name || '',
              part?.phoneNumber || '',
              s.cbm || '',
            ]);
          }
        }
      }

      this.finalizeSheet(sheet, {
        freezeAtRow: headerRowNumber,
        zebraFromRow: headerRowNumber + 1,
        numberColumns: [9],
      });
    }
    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }
}
