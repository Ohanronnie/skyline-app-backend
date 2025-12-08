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

    // Prevent assigning both customerId and partnerId
    if (dto.customerId && dto.partnerId) {
      throw new BadRequestException(
        'Shipment cannot be assigned to both a customer and a partner',
      );
    }

    const statusToPersist = dto.status ?? ShipmentStatus.RECEIVED;

    if (existing) {
      // Prevent changing existing assignments
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

      const hasChanges = statusChanged || customerChanged || partnerChanged;

      if (!hasChanges) {
        return existing;
      }

      // Update fields if provided
      if (statusChanged) {
        existing.status = dto.status!; // Safe because statusChanged checks dto.status exists
      }
      // Only allow adding customerId if not already assigned and no partnerId conflict
      if (dto.customerId && !existing.customerId && !existing.partnerId) {
        existing.customerId = dto.customerId;
      }
      // Only allow adding partnerId if not already assigned and no customerId conflict
      if (dto.partnerId && !existing.partnerId && !existing.customerId) {
        existing.partnerId = dto.partnerId;
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

    const doc = new this.shipmentModel({
      ...dto,
      status: statusToPersist,
      organization,
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
  ): Promise<ShipmentDocument[]> {
    const baseFilter: FilterQuery<ShipmentDocument> = {
      ...buildOrganizationFilter(organization),
    };
    if (partnerId) {
      baseFilter.partnerId = partnerId;
    }
    if (customerId) {
      baseFilter.customerId = customerId;
    }

    //console.log(baseFilter, warehouseIds);
    if (false && warehouseIds && warehouseIds!.length > 0) {
      return this.shipmentModel
        .find({
          ...baseFilter,
          $or: [
            { originWarehouseId: { $in: warehouseIds } },
            { currentWarehouseId: { $in: warehouseIds } },
          ],
        })
        .exec();
    }
    const shipments = await this.shipmentModel
      .find(baseFilter)
      .populate('customerId', 'name phone email location')
      .populate('partnerId', 'name phone email')
      .populate('containerId', 'containerNumber')
      .exec();
    //  console.log(shipments);
    return shipments;
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<ShipmentDocument> {
    const found = await this.shipmentModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .populate('customerId', 'name phone email location')
      .populate('partnerId', 'name phone email')
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
    // First, fetch the existing shipment to check partnerId
    const existingShipment = await this.shipmentModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (!existingShipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Prevent assigning both customerId and partnerId
    if (dto.customerId && dto.partnerId) {
      throw new BadRequestException(
        'Shipment cannot be assigned to both a customer and a partner',
      );
    }

    const updateData = { ...dto };
    // console.log(updateData);
    const statusChanging =
      'status' in updateData &&
      updateData.status &&
      updateData.status !== existingShipment.status;

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
      // Partners can assign customers to their shipments
      if (
        userRole === 'partner' &&
        userId !== existingShipment.partnerId.toString()
      ) {
        // Partner can only modify their own shipments
        throw new BadRequestException(
          'You can only modify shipments assigned to you',
        );
      }
      // Admin cannot change customerId if shipment is assigned to a partner
      // Only block if customerId is actually being changed/assigned
      if (
        userRole !== 'partner' &&
        'customerId' in updateData &&
        updateData.customerId !== undefined &&
        updateData.customerId !== null &&
        updateData.customerId !== existingShipment.customerId?.toString()
      ) {
        throw new BadRequestException(
          'Cannot assign customer to a shipment that is already assigned to a partner. Partner must assign the customer.',
        );
      }
    }

    // Prevent changing existing customerId assignment
    if (existingShipment.customerId) {
      if (
        'customerId' in updateData &&
        updateData.customerId !== existingShipment.customerId.toString()
      ) {
        throw new BadRequestException(
          'Cannot change customer assignment once a shipment is assigned to a customer',
        );
      }
      // Prevent assigning partnerId if customerId exists
      if ('partnerId' in updateData && updateData.partnerId) {
        throw new BadRequestException(
          'Cannot assign partner to a shipment that is already assigned to a customer',
        );
      }
    }

    // If user is a partner, prevent them from changing partnerId
    if (userRole === 'partner' && 'partnerId' in updateData) {
      delete updateData.partnerId;
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
  ): Promise<ShipmentDocument[]> {
    // Sanitize input to prevent ReDoS attacks
    const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: FilterQuery<ShipmentDocument> = {
      ...buildOrganizationFilter(organization),
      $or: [
        { trackingNumber: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
      ],
    };
    return this.shipmentModel.find(filter).exec();
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.shipmentModel
      .deleteOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Shipment not found');
    }
  }
}
