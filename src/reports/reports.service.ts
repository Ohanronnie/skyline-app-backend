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

    if (dto.mode === ReportMode.SUMMARY) {
      const totalShipments = shipments.length;
      const totalCbm = shipments.reduce((sum, s) => sum + (s.cbm || 0), 0);
      const totalQuantity = shipments.reduce(
        (sum, s) => sum + (s.quantity || 0),
        0,
      );

      sheet.addRow(['Summary']);
      sheet.addRow(['Total Shipments', totalShipments]);
      sheet.addRow(['Total CBM', totalCbm.toFixed(3)]);
      sheet.addRow(['Total Quantity', totalQuantity]);
      sheet.addRow([]);

      sheet.addRow(['Per Customer']);
      sheet.addRow(['Customer Name', 'Shipments', 'Total CBM', 'Total Qty']);
      const byCustomer = new Map<
        string,
        { name: string; count: number; cbm: number; qty: number }
      >();
      for (const s of shipments) {
        // Collect all related customer IDs and names for summary
        const relatedCustomers = new Set<string>();
        if (s.customerId) relatedCustomers.add(s.customerId.toString());
        if (s.partnerCustomerId)
          relatedCustomers.add(s.partnerCustomerId.toString());
        if (s.customerIds)
          s.customerIds.forEach((id: any) => relatedCustomers.add(id.toString()));
        if (s.partnerAssignments)
          s.partnerAssignments.forEach((a: any) =>
            relatedCustomers.add(a.customerId.toString()),
          );

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
              const custId = (cust._id || cust).toString();
              return custId === key;
            }) || key;

          name = (c as any).name || `Unknown (${key})`;

          const entry = byCustomer.get(key) || {
            name,
            count: 0,
            cbm: 0,
            qty: 0,
          };
          entry.count += 1;
          entry.cbm += s.cbm || 0;
          entry.qty += s.quantity || 0;
          byCustomer.set(key, entry);
        }
      }
      for (const entry of byCustomer.values()) {
        sheet.addRow([
          entry.name,
          entry.count,
          entry.cbm.toFixed(3),
          entry.qty,
        ]);
      }
    } else {
      sheet.addRow([
        'Tracking Number',
        'Status',
        'CBM',
        'Quantity',
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
      for (const s of shipments) {
        const c: any = s.customerId;
        const p: any = s.partnerId;
        const pc: any = (s as any).partnerCustomerId;
        const cont: any = s.containerId;
        sheet.addRow([
          s.trackingNumber,
          s.status,
          s.cbm ?? '',
          s.quantity ?? '',
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
          (s as any).createdAt ? (s as any).createdAt.toISOString() : '',
          s.deliveredAt ? s.deliveredAt.toISOString() : '',
        ]);
      }
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
    const orgFilter = organization ? buildOrganizationFilter(organization) : {};

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');

    if (dto.mode === ReportMode.SUMMARY) {
      if (dto.customerId && customers.length === 1) {
        const targetCustomer = data.customer;
        const shipments = data.shipments || [];

        sheet.addRow(['CUSTOMER DASHBOARD']);
        sheet.addRow(['Name', targetCustomer?.name]);
        sheet.addRow(['Type', targetCustomer?.type]);
        sheet.addRow(['Location', targetCustomer?.location]);
        sheet.addRow(['Email', targetCustomer?.email || 'N/A']);
        sheet.addRow(['Phone', targetCustomer?.phone || 'N/A']);
        sheet.addRow([]);

        const totalCbm = shipments.reduce(
          (s: number, ship: any) => s + (ship.cbm || 0),
          0,
        );
        const totalQty = shipments.reduce(
          (s: number, ship: any) => s + (ship.quantity || 0),
          0,
        );

        sheet.addRow(['KEY METRICS']);
        sheet.addRow(['Total Shipments', shipments.length]);
        sheet.addRow(['Total Volume (CBM)', totalCbm.toFixed(3)]);
        sheet.addRow(['Total Quantity (Items)', totalQty]);
        sheet.addRow([
          'Average CBM per Shipment',
          shipments.length ? (totalCbm / shipments.length).toFixed(3) : 0,
        ]);
        sheet.addRow([]);

        sheet.addRow(['SHIPMENT STATUS BREAKDOWN']);
        const statusCounts = new Map<string, number>();
        shipments.forEach((s: any) =>
          statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1),
        );
        for (const [status, count] of statusCounts.entries()) {
          sheet.addRow([status.toUpperCase().replace(/_/g, ' '), count]);
        }

        if (shipments.length > 0) {
          const dates = shipments
            .map((s: any) => (s as any).createdAt)
            .filter(Boolean)
            .sort();
          sheet.addRow([]);
          sheet.addRow(['ACTIVITY DATES']);
          sheet.addRow([
            'First Shipment',
            dates[0].toISOString().split('T')[0],
          ]);
          sheet.addRow([
            'Latest Shipment',
            dates[dates.length - 1].toISOString().split('T')[0],
          ]);
        }
      } else {
        sheet.addRow(['Summary']);
        sheet.addRow(['Total Customers', customers.length]);
        sheet.addRow([]);
        sheet.addRow(['By Type']);
        const byType = new Map<string, number>();
        customers.forEach((c) =>
          byType.set(c.type, (byType.get(c.type) || 0) + 1),
        );
        byType.forEach((count, type) => sheet.addRow([type, count]));
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
        'Match Source',
        'Container Number',
        'CBM',
        'Quantity',
        'Total Shipments (Lifetime)',
      ]);
      const shipments = data.shipments || [];

      const shipmentsByCustomer = new Map<
        string,
        Array<{ shipment: ShipmentDocument; source: string }>
      >();
      shipments.forEach((s: any) => {
        const idToSource = new Map<string, string>();
        if (s.customerId) idToSource.set(s.customerId.toString(), 'Primary');
        if (s.partnerCustomerId)
          idToSource.set(s.partnerCustomerId.toString(), 'Partner-Specific');
        if (s.customerIds)
          s.customerIds.forEach((id: any) =>
            idToSource.set(id.toString(), 'Array (Multiple)'),
          );
        if (s.partnerAssignments)
          s.partnerAssignments.forEach((a: any) =>
            idToSource.set(a.customerId.toString(), 'Partner Assignment'),
          );

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
            c.type,
            c.location,
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
            0,
          ]);
        } else {
          for (const entry of cShips) {
            const s = entry.shipment;
            const cont: any = s.containerId;
            sheet.addRow([
              c.name,
              c.type,
              c.location,
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
              s.quantity || 0,
              cShips.length,
            ]);
          }
        }
      }
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
    const orgFilter = organization ? buildOrganizationFilter(organization) : {};

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Containers');

    if (dto.mode === ReportMode.SUMMARY) {
      sheet.addRow(['Container Number', 'Status', 'Total Shipments']);
      const counts = data.shipmentCounts || [];
      const countMap = new Map(
        counts.map((item: any) => [
          item._id?.toString(),
          item.count,
        ]),
      );

      for (const c of containers) {
        const count = countMap.get(c._id.toString()) || 0;
        sheet.addRow([c.containerNumber, c.status, count]);
      }
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
        'Quantity',
      ]);
      const shipments = data.shipments || [];
      const shipsByContainer = new Map<string, ShipmentDocument[]>();
      shipments.forEach((s) => {
        const key = s.containerId?.toString() || 'unknown';
        const arr = shipsByContainer.get(key) || [];
        arr.push(s);
        shipsByContainer.set(key, arr);
      });

      for (const c of containers) {
        const list = shipsByContainer.get(c._id.toString()) || [];
        if (list.length === 0) {
          sheet.addRow([c.containerNumber, c.status, ...Array(8).fill('')]);
        } else {
          for (const s of list) {
            const cust: any = s.customerId;
            const part: any = s.partnerId;
            sheet.addRow([
              c.containerNumber,
              c.status,
              s.trackingNumber,
              s.status,
              cust?.name || '',
              cust?.phone || '',
              part?.name || '',
              part?.phoneNumber || '',
              s.cbm || '',
              s.quantity || '',
            ]);
          }
        }
      }
    }
    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }
}
