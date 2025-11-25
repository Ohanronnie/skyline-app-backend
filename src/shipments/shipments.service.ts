import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Shipment, ShipmentDocument } from './shipments.schema';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { Organization } from '../user/users.schema';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
  ) {}

  async create(
    dto: CreateShipmentDto,
    organization: Organization,
  ): Promise<ShipmentDocument> {
    // Check for duplicate tracking number
    const existing = await this.shipmentModel
      .findOne({
        trackingNumber: dto.trackingNumber,
        organization,
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        `Shipment with tracking number ${dto.trackingNumber} already exists`,
      );
    }

    const doc = new this.shipmentModel({ ...dto, organization });
    console.log(doc);
    return doc.save();
  }

  async findAll(
    organization: Organization,
    warehouseIds?: string[],
    partnerId?: string,
  ): Promise<ShipmentDocument[]> {
    const baseFilter: FilterQuery<ShipmentDocument> = { organization };
    if (partnerId) {
      baseFilter.partnerId = partnerId;
    }

    console.log(baseFilter, warehouseIds);
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
      .populate('customerId', 'name')
      .exec();
    console.log(shipments);
    return shipments;
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<ShipmentDocument> {
    const found = await this.shipmentModel
      .findOne({ _id: id, organization })
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
      .findOne({ _id: id, organization })
      .exec();
    
    if (!existingShipment) {
      throw new NotFoundException('Shipment not found');
    }

    const updateData = { ...dto };
    
    // If user is a partner, prevent them from changing partnerId
    if (userRole === 'partner' && 'partnerId' in updateData) {
      delete updateData.partnerId;
    }
    
    // If shipment is assigned to a partner and admin tries to change customerId, prevent it
    if (userRole !== 'partner' && existingShipment.partnerId && 'customerId' in updateData) {
      delete updateData.customerId;
    }
    
    const updated = await this.shipmentModel
      .findOneAndUpdate({ _id: id, organization }, { $set: updateData }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Shipment not found');
    return updated;
  }

  async search(
    query: string,
    organization: Organization,
  ): Promise<ShipmentDocument[]> {
    // Sanitize input to prevent ReDoS attacks
    const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter: FilterQuery<ShipmentDocument> = {
      organization,
      $or: [
        { trackingNumber: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
      ],
    };
    return this.shipmentModel.find(filter).exec();
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.shipmentModel
      .deleteOne({ _id: id, organization })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Shipment not found');
    }
  }
}
