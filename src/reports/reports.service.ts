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

  async shipmentsAnalytics() {
    const total = await this.shipmentModel.countDocuments();
    const byStatus = await this.shipmentModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return { total, byStatus };
  }

  async containersPerformance() {
    const total = await this.containerModel.countDocuments();
    const active = await this.containerModel.countDocuments({
      status: {
        $in: [
          ContainerStatus.LOADING,
          ContainerStatus.LOADED,
          ContainerStatus.IN_TRANSIT,
        ],
      },
    });
    const byStatus = await this.containerModel.aggregate([
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
        return this.exportShipmentsExcel(dto, organization);
      case ReportType.CUSTOMERS:
        return this.exportCustomersExcel(dto, organization);
      case ReportType.CONTAINERS:
        return this.exportContainersExcel(dto, organization);
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

  private async exportShipmentsExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    this.logger.log(`[exportShipmentsExcel] Starting - mode: ${dto.mode}`);
    this.logger.log(
      `[exportShipmentsExcel] Full DTO: ${JSON.stringify(dto, null, 2)}`,
    );

    const { from, to } = this.parseDateRange(dto);
    this.logger.log(
      `[exportShipmentsExcel] Date range - from: ${from}, to: ${to}`,
    );

    const query: any = {};
    if (from || to) {
      query.receivedAt = {};
      if (from) query.receivedAt.$gte = from;
      if (to) query.receivedAt.$lte = to;
    }
    if (dto.partnerId) {
      query.partnerId = new Types.ObjectId(dto.partnerId);
      this.logger.log(
        `[exportShipmentsExcel] Filtering by partnerId: ${dto.partnerId}`,
      );
    }
    if (dto.customerId) {
      query.customerId = (dto.customerId).toString();
      this.logger.log(
        `[exportShipmentsExcel] Filtering by customerId: ${dto.customerId}`,
      );
    }
    if (dto.containerId) {
      query.containerId = (dto.containerId).toString();
      this.logger.log(
        `[exportShipmentsExcel] Filtering by containerId: ${dto.containerId}`,
      );
    }
    if (dto.shipmentStatuses?.length) {
      query.status = { $in: dto.shipmentStatuses };
      this.logger.log(
        `[exportShipmentsExcel] Filtering by statuses: ${dto.shipmentStatuses.join(', ')}`,
      );
    }

    // Handle selectedShipments if provided (from frontend payload)
    const payload = (dto as any).payload;
    if (
      payload?.selectedShipments &&
      Array.isArray(payload.selectedShipments) &&
      payload.selectedShipments.length > 0
    ) {
      query._id = {
        $in: payload.selectedShipments.map(
          (id: string) => id.toString(),
        ),
      };
      this.logger.log(
        `[exportShipmentsExcel] Filtering by selectedShipments: ${payload.selectedShipments.length} shipments`,
      );
    }

    // Apply organization filter if provided
    if (organization) {
      Object.assign(query, buildOrganizationFilter(organization));
      this.logger.log(
        `[exportShipmentsExcel] Applied organization filter: ${organization}`,
      );
    }

    this.logger.log(
      `[exportShipmentsExcel] Final query: ${JSON.stringify(query, null, 2)}`,
    );

    const shipments = await this.shipmentModel
      .find(query)
      .populate('customerId', 'name phone email location')
      .populate('partnerId', 'name phoneNumber')
      .populate('containerId', 'containerNumber')
      .sort({ createdAt: -1 })
      .exec();

    this.logger.log(
      `[exportShipmentsExcel] Found ${shipments.length} shipments`,
    );
    if (shipments.length === 0) {
      this.logger.warn(
        `[exportShipmentsExcel] No shipments found with query: ${JSON.stringify(query)}`,
      );
    } else {
      this.logger.log(
        `[exportShipmentsExcel] Sample shipment IDs: ${shipments
          .slice(0, 3)
          .map((s) => s._id.toString())
          .join(', ')}`,
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Shipments');

    this.logger.log(
      `[exportShipmentsExcel] Creating Excel workbook - mode: ${dto.mode}`,
    );

    if (dto.mode === ReportMode.SUMMARY) {
      // Summary: totals and per customer/per partner
      const totalShipments = shipments.length;
      const totalCbm = shipments.reduce((sum, s) => sum + (s.cbm || 0), 0);
      const totalQuantity = shipments.reduce(
        (sum, s) => sum + (s.quantity || 0),
        0,
      );

      this.logger.log(
        `[exportShipmentsExcel] Summary totals - shipments: ${totalShipments}, CBM: ${totalCbm}, Qty: ${totalQuantity}`,
      );

      sheet.addRow(['Summary']);
      sheet.addRow(['Total Shipments', totalShipments]);
      sheet.addRow(['Total CBM', totalCbm]);
      sheet.addRow(['Total Quantity', totalQuantity]);
      sheet.addRow([]);

      // Per customer
      sheet.addRow(['Per Customer']);
      sheet.addRow(['Customer Name', 'Shipments', 'Total CBM', 'Total Qty']);
      const byCustomer = new Map<
        string,
        { name: string; count: number; cbm: number; qty: number }
      >();
      for (const s of shipments) {
        const c: any = s.customerId;
        if (!c) continue;
        const key = c._id.toString();
        const entry =
          byCustomer.get(key) ||
          ({ name: c.name, count: 0, cbm: 0, qty: 0 } as any);
        entry.count += 1;
        entry.cbm += s.cbm || 0;
        entry.qty += s.quantity || 0;
        byCustomer.set(key, entry);
      }
      for (const entry of byCustomer.values()) {
        sheet.addRow([entry.name, entry.count, entry.cbm, entry.qty]);
      }

      sheet.addRow([]);
      sheet.addRow(['Per Partner']);
      sheet.addRow(['Partner Name', 'Shipments', 'Total CBM', 'Total Qty']);
      const byPartner = new Map<
        string,
        { name: string; count: number; cbm: number; qty: number }
      >();
      for (const s of shipments) {
        const p: any = s.partnerId;
        if (!p) continue;
        const key = p._id.toString();
        const entry =
          byPartner.get(key) ||
          ({ name: p.name, count: 0, cbm: 0, qty: 0 } as any);
        entry.count += 1;
        entry.cbm += s.cbm || 0;
        entry.qty += s.quantity || 0;
        byPartner.set(key, entry);
      }
      for (const entry of byPartner.values()) {
        sheet.addRow([entry.name, entry.count, entry.cbm, entry.qty]);
      }

      this.logger.log(
        `[exportShipmentsExcel] Summary - customers: ${byCustomer.size}, partners: ${byPartner.size}`,
      );
    } else {
      this.logger.log(
        `[exportShipmentsExcel] Detailed mode - adding ${shipments.length} rows`,
      );
      // Detailed
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
        'Container Number',
        'Description',
        'Received At',
        'Delivered At',
      ]);
      for (const s of shipments) {
        const c: any = s.customerId;
        const p: any = s.partnerId;
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
          cont?.containerNumber ?? '',
          s.description ?? '',
          s.receivedAt ? s.receivedAt.toISOString() : '',
          s.deliveredAt ? s.deliveredAt.toISOString() : '',
        ]);
      }
    }

    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }

  private async exportCustomersExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    const query: any = {};
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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Customers');

    if (dto.mode === ReportMode.SUMMARY) {
      // Summary: counts by type and location
      sheet.addRow(['Summary']);
      sheet.addRow(['Total Customers', customers.length]);
      sheet.addRow([]);

      sheet.addRow(['By Type']);
      sheet.addRow(['Type', 'Count']);
      const byType = new Map<string, number>();
      for (const c of customers) {
        const key = c.type;
        byType.set(key, (byType.get(key) || 0) + 1);
      }
      for (const [type, count] of byType.entries()) {
        sheet.addRow([type, count]);
      }

      sheet.addRow([]);
      sheet.addRow(['By Location']);
      sheet.addRow(['Location', 'Count']);
      const byLocation = new Map<string, number>();
      for (const c of customers) {
        const key = c.location;
        byLocation.set(key, (byLocation.get(key) || 0) + 1);
      }
      for (const [loc, count] of byLocation.entries()) {
        sheet.addRow([loc, count]);
      }
    } else {
      // Detailed: one row per customer
      sheet.addRow([
        'Name',
        'Type',
        'Location',
        'Email',
        'Phone',
        'Address',
        'Partner Name',
        'Partner Phone',
      ]);
      for (const c of customers) {
        const p: any = c.partnerId;
        sheet.addRow([
          c.name,
          c.type,
          c.location,
          c.email ?? '',
          c.phone ?? '',
          c.address ?? '',
          p?.name ?? '',
          p?.phoneNumber ?? '',
        ]);
      }
    }

    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }

  private async exportContainersExcel(
    dto: GenerateExcelReportDto,
    organization?: Organization,
  ): Promise<Uint8Array> {
    const { from, to } = this.parseDateRange(dto);

    const containerQuery: any = {};
    if (dto.containerId) {
      containerQuery._id = new Types.ObjectId(dto.containerId);
    }

    // For now, ignore date range on containers; could map to departure/arrival later
    const containers = await this.containerModel
      .find(containerQuery)
      .sort({ createdAt: -1 })
      .exec();

    // Preload shipments per container if detailed mode
    let shipmentsByContainer = new Map<string, ShipmentDocument[]>();
    if (dto.mode === ReportMode.DETAILED) {
      const containerIds = containers.map((c) => c._id);
      const shipmentQuery: any = { containerId: { $in: containerIds } };
      if (from || to) {
        shipmentQuery.receivedAt = {};
        if (from) shipmentQuery.receivedAt.$gte = from;
        if (to) shipmentQuery.receivedAt.$lte = to;
      }
      const shipments = await this.shipmentModel
        .find(shipmentQuery)
        .populate('customerId', 'name phone email')
        .populate('partnerId', 'name phoneNumber')
        .exec();
      shipmentsByContainer = shipments.reduce((map, s) => {
        const key = s.containerId?.toString() || 'unknown';
        const arr = map.get(key) || [];
        arr.push(s);
        map.set(key, arr);
        return map;
      }, new Map<string, ShipmentDocument[]>());
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Containers');

    if (dto.mode === ReportMode.SUMMARY) {
      // Summary: one row per container with counts/totals
      sheet.addRow(['Container Number', 'Status', 'Total Shipments']);
      for (const c of containers) {
        const shipmentsCount = await this.shipmentModel.countDocuments({
          containerId: c._id,
        });
        sheet.addRow([c.containerNumber, c.status, shipmentsCount]);
      }
    } else {
      // Detailed: one row per shipment in each container
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

      for (const c of containers) {
        const list = shipmentsByContainer.get(c._id.toString()) || [];
        if (list.length === 0) {
          sheet.addRow([
            c.containerNumber,
            c.status,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ]);
        } else {
          for (const s of list) {
            const cust: any = s.customerId;
            const partner: any = s.partnerId;
            sheet.addRow([
              c.containerNumber,
              c.status,
              s.trackingNumber,
              s.status,
              cust?.name ?? '',
              cust?.phone ?? '',
              partner?.name ?? '',
              partner?.phoneNumber ?? '',
              s.cbm ?? '',
              s.quantity ?? '',
            ]);
          }
        }
      }
    }

    return workbook.xlsx.writeBuffer() as unknown as Uint8Array;
  }
}
