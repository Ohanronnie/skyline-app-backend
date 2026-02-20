import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Shipment, ShipmentDocument, ShipmentStatus } from './shipments.schema';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { Organization } from '../user/users.schema';
import {
  Tracking,
  TrackingDocument,
  TrackingEntityType,
} from '../tracking/tracking.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ShipmentStatusUpdatedEvent } from '../events/shipment.events';
import { buildOrganizationFilter } from '../auth/organization-filter.util';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Tracking.name)
    private readonly trackingModel: Model<TrackingDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async recordShipmentTracking(
    organization: Organization,
    shipmentId: string,
    trackingNumber: string,
    status: string,
    metadata?: Record<string, any>,
  ) {
    await this.trackingModel.create({
      organization,
      trackingNumber,
      status,
      entityType: TrackingEntityType.SHIPMENT,
      entityId: shipmentId,
      metadata,
    });
  }

  async create(
    dto: CreateShipmentDto,
    organization: Organization,
  ): Promise<ShipmentDocument> {
    const existing = await this.shipmentModel
      .findOne({
        trackingNumber: dto.trackingNumber,
        ...buildOrganizationFilter(organization),
      })
      .exec();

    const statusToPersist = dto.status ?? ShipmentStatus.RECEIVED;

    if (existing) {
      // Prevent changing existing assignments (but allow setting them if not already set)
      if (
        existing.partnerId &&
        dto.partnerId &&
        dto.partnerId !== existing.partnerId.toString()
      ) {
        throw new BadRequestException(
          'Cannot change partner assignment once a shipment is assigned to a partner',
        );
      }
      if (
        existing.customerId &&
        dto.customerId &&
        dto.customerId !== existing.customerId.toString()
      ) {
        throw new BadRequestException(
          'Cannot change customer assignment once a shipment is assigned to a customer',
        );
      }

      const statusChanged = dto.status && dto.status !== existing.status;
      const customerChanged =
        dto.customerId && dto.customerId !== existing.customerId?.toString();
      const partnerChanged =
        dto.partnerId && dto.partnerId !== existing.partnerId?.toString();
      const partnerCustomerChanged =
        dto.partnerCustomerId &&
        dto.partnerCustomerId !== existing.partnerCustomerId?.toString();

      const hasChanges =
        statusChanged ||
        customerChanged ||
        partnerChanged ||
        partnerCustomerChanged;

      if (!hasChanges) {
        return existing;
      }

      // Update fields if provided
      if (statusChanged) {
        existing.status = dto.status!;
      }
      // Allow adding customerId if not already assigned
      if (dto.customerId && !existing.customerId) {
        existing.customerId = dto.customerId;
      }
      // Allow adding partnerId if not already assigned
      if (dto.partnerId && !existing.partnerId) {
        existing.partnerId = dto.partnerId;
      }
      // Allow setting/updating partnerCustomerId
      if (dto.partnerCustomerId) {
        existing.partnerCustomerId = dto.partnerCustomerId;
      }

      const updated = await existing.save();

      // Record tracking if status changed
      if (statusChanged) {
        await this.recordShipmentTracking(
          organization,
          updated._id.toString(),
          updated.trackingNumber,
          updated.status,
          { source: 'shipment_status_update' },
        );

        // Emit event for notifications and SMS
        this.eventEmitter.emit(
          'shipment.status.updated',
          new ShipmentStatusUpdatedEvent(updated, existing.status),
        );
      }

      return updated;
    }

    // Merge single + array fields for backward compatibility
    const customerIds = this.mergeIds(dto.customerId, dto.customerIds);
    const partnerIds = this.mergeIds(dto.partnerId, dto.partnerIds);

    // Initialize partnerAssignments if partnerId and partnerCustomerId provided
    const partnerAssignments: Array<{ partnerId: string; customerId: string }> =
      [];
    if (dto.partnerId && dto.partnerCustomerId) {
      partnerAssignments.push({
        partnerId: dto.partnerId,
        customerId: dto.partnerCustomerId,
      });
    }

    const doc = new this.shipmentModel({
      ...dto,
      status: statusToPersist,
      organization,
      customerIds,
      partnerIds,
      partnerAssignments,
      // Store first ID in legacy fields for backward compat
      customerId: customerIds[0] || null,
      partnerId: partnerIds[0] || null,
    });

    const saved = await doc.save();

    await this.recordShipmentTracking(
      organization,
      saved._id.toString(),
      saved.trackingNumber,
      statusToPersist,
      { source: 'shipment_created' },
    );

    return saved;
  }

  async findAll(
    organization: Organization,
    warehouseIds?: string[],
    partnerId?: string,
    customerId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: ShipmentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const baseFilter: FilterQuery<ShipmentDocument> = {
      ...buildOrganizationFilter(organization),
    };
    if (partnerId) {
      baseFilter.partnerId = partnerId;
    }
    if (customerId) {
      baseFilter.customerId = customerId;
    }

    const skip = (page - 1) * limit;

    let filter = baseFilter;
    if (false && warehouseIds && warehouseIds!.length > 0) {
      filter = {
        ...baseFilter,
        $or: [
          { originWarehouseId: { $in: warehouseIds } },
          { currentWarehouseId: { $in: warehouseIds } },
        ],
      };
    }

    const [shipments, total] = await Promise.all([
      this.shipmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name phone email location')
        .populate('customerIds', 'name phone email location')
        .populate('partnerId', 'name phone email')
        .populate('partnerIds', 'name phone email')
        .populate('partnerCustomerId', 'name phone email location')
        .populate('partnerAssignments.partnerId', 'name phone email')
        .populate('partnerAssignments.customerId', 'name phone email location')
        .populate('containerId', 'containerNumber')
        .exec(),
      this.shipmentModel.countDocuments(filter).exec(),
    ]);

    return {
      data: shipments,
      total,
      page,
      limit,
    };
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<ShipmentDocument> {
    const found = await this.shipmentModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .populate('customerId', 'name phone email location')
      .populate('customerIds', 'name phone email location')
      .populate('partnerId', 'name phone email')
      .populate('partnerIds', 'name phone email')
      .populate('partnerCustomerId', 'name phone email location')
      .populate('partnerAssignments.partnerId', 'name phone email')
      .populate('partnerAssignments.customerId', 'name phone email location')
      .populate('containerId', 'containerNumber')
      .exec();
    if (!found) throw new NotFoundException('Shipment not found');
    return found;
  }

  async update(
    id: string,
    dto: UpdateShipmentDto,
    organization: Organization,
    userRole?: string,
    userId?: string,
  ): Promise<ShipmentDocument> {
    console.log('[SHIPMENT UPDATE DEBUG] Update called with:', {
      id,
      dto,
      userRole,
      userId,
    });

    // First, fetch the existing shipment to check partnerId
    const existingShipment = await this.shipmentModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (!existingShipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Merge single + array fields for backward compatibility
    const customerIds = this.mergeIds(dto.customerId, dto.customerIds);
    const partnerIds = this.mergeIds(dto.partnerId, dto.partnerIds);

    const updateData: any = { ...dto };

    if (customerIds.length > 0) {
      updateData.customerIds = customerIds;
      updateData.customerId = customerIds[0];
    }

    if (partnerIds.length > 0) {
      updateData.partnerIds = partnerIds;
      updateData.partnerId = partnerIds[0];
    }

    // Sync partnerAssignments if partnerId and partnerCustomerId provided
    if (dto.partnerId && dto.partnerCustomerId) {
      const assignments = existingShipment.partnerAssignments || [];
      const idx = assignments.findIndex((a) => a.partnerId === dto.partnerId);

      if (idx > -1) {
        assignments[idx].customerId = dto.partnerCustomerId;
      } else {
        assignments.push({
          partnerId: dto.partnerId,
          customerId: dto.partnerCustomerId,
        });
      }

      updateData.partnerAssignments = assignments;
    }

    // Prevent changing existing partnerId assignment
    if (existingShipment.partnerId) {
      if (
        updateData['partnerId'] &&
        updateData.partnerId !== existingShipment.partnerId.toString()
      ) {
        throw new BadRequestException(
          'Cannot change partner assignment once a shipment is assigned to a partner',
        );
      }
      // Partners can only modify their own shipments
      if (
        userRole === 'partner' &&
        userId !== existingShipment.partnerId.toString()
      ) {
        throw new BadRequestException(
          'You can only modify shipments assigned to you',
        );
      }
    }

    // Prevent changing existing customerId assignment (admin's customer) - only for admins
    if (userRole !== 'partner' && existingShipment.customerId) {
      if (
        'customerId' in updateData &&
        updateData.customerId &&
        updateData.customerId !== existingShipment.customerId.toString()
      ) {
        throw new BadRequestException(
          'Cannot change customer assignment once a shipment is assigned to a customer',
        );
      }
    }

    const statusChanging =
      'status' in updateData &&
      updateData.status &&
      updateData.status !== existingShipment.status;

    // If user is a partner, manage their partnerAssignments instead of main fields
    if (userRole === 'partner' && userId) {
      // Partners may send customerId instead of partnerCustomerId
      const customerIdToUse = dto.partnerCustomerId || dto.customerId;

      console.log('[PARTNER ASSIGNMENT DEBUG] Partner update detected', {
        partnerId: userId,
        partnerCustomerId: dto.partnerCustomerId,
        customerId: dto.customerId,
        customerIdToUse,
        existingAssignments: existingShipment.partnerAssignments,
      });

      // Partner managing their specific assignment
      const assignments = existingShipment.partnerAssignments || [];
      const idx = assignments.findIndex((a) => a.partnerId === userId);

      console.log('[PARTNER ASSIGNMENT DEBUG] Found index:', idx);

      if (customerIdToUse) {
        if (idx > -1) {
          console.log(
            '[PARTNER ASSIGNMENT DEBUG] Updating existing assignment at index',
            idx,
          );
          assignments[idx].customerId = customerIdToUse;
        } else {
          console.log('[PARTNER ASSIGNMENT DEBUG] Creating new assignment');
          assignments.push({ partnerId: userId, customerId: customerIdToUse });
        }
        updateData.partnerAssignments = assignments;
        updateData.partnerCustomerId = customerIdToUse; // Also update legacy field

        console.log(
          '[PARTNER ASSIGNMENT DEBUG] Final assignments array:',
          assignments,
        );
      } else if (
        idx > -1 &&
        ('partnerCustomerId' in dto || 'customerId' in dto) &&
        !customerIdToUse
      ) {
        // Remove assignment if explicitly set to null/undefined
        console.log(
          '[PARTNER ASSIGNMENT DEBUG] Removing assignment at index',
          idx,
        );
        assignments.splice(idx, 1);
        updateData.partnerAssignments = assignments;
        updateData.partnerCustomerId = null;
      }

      // Partners cannot modify admin's fields
      delete updateData.partnerId;
      delete updateData.customerId;
      delete updateData.customerIds;
      delete updateData.partnerIds;

      console.log('[PARTNER ASSIGNMENT DEBUG] Update data after deletions:', {
        partnerAssignments: updateData.partnerAssignments,
        partnerCustomerId: updateData.partnerCustomerId,
      });
    }

    const updated = await this.shipmentModel
      .findOneAndUpdate(
        { _id: id, ...buildOrganizationFilter(organization) },
        { $set: updateData },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Shipment not found');

    if (statusChanging) {
      await this.recordShipmentTracking(
        organization,
        updated._id.toString(),
        updated.trackingNumber,
        updated.status,
        { source: 'shipment_edit_status_change', userId },
      );

      // Emit event for notifications
      this.eventEmitter.emit(
        'shipment.status.updated',
        new ShipmentStatusUpdatedEvent(updated, existingShipment.status),
      );
    }

    return updated;
  }

  async search(
    query: string,
    organization: Organization,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: ShipmentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Sanitize input to prevent ReDoS attacks
    const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: FilterQuery<ShipmentDocument> = {
      ...buildOrganizationFilter(organization),
      $or: [
        { trackingNumber: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
      ],
    };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.shipmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.shipmentModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.shipmentModel
      .deleteOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Shipment not found');
    }
  }

  async getTrackingSummary(organization: Organization): Promise<any> {
    const filter = buildOrganizationFilter(organization);

    const [statsResult, recent] = await Promise.all([
      this.shipmentModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.shipmentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id trackingNumber status createdAt')
        .exec(),
    ]);

    const stats = {
      inTransit: 0,
      delivered: 0,
      pending: 0,
      atWarehouse: 0,
    };

    statsResult.forEach((item) => {
      const status = item._id as ShipmentStatus;
      const count = item.count;

      if (
        [
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.LOADED,
          ShipmentStatus.LOADED_CHINA,
          ShipmentStatus.DISPATCHED_KUMASI,
          ShipmentStatus.DISPATCHED_NKORANZA,
        ].includes(status)
      ) {
        stats.inTransit += count;
      } else if (
        [
          ShipmentStatus.DELIVERED,
          ShipmentStatus.DELIVERED_ACCRA,
          ShipmentStatus.DELIVERED_KUMASI,
          ShipmentStatus.DELIVERED_NKORANZA,
        ].includes(status)
      ) {
        stats.delivered += count;
      } else if (
        [ShipmentStatus.RECEIVED, ShipmentStatus.RECEIVED_CHINA].includes(
          status,
        )
      ) {
        stats.pending += count;
      } else if (
        [
          ShipmentStatus.INSPECTED,
          ShipmentStatus.ARRIVED_GHANA,
          ShipmentStatus.RECEIVED_ACCRA,
          ShipmentStatus.RECEIVED_KUMASI,
          ShipmentStatus.RECEIVED_NKORANZA,
        ].includes(status)
      ) {
        stats.atWarehouse += count;
      }
    });

    return {
      stats,
      recent,
    };
  }

  // Helper method to merge single ID and array of IDs
  private mergeIds(single?: string, array?: string[]): string[] {
    const ids = new Set<string>();
    if (single) ids.add(single);
    if (array) array.forEach((id) => ids.add(id));
    return Array.from(ids);
  }
}
