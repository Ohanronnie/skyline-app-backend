import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './warehouses.schema';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { Organization } from '../user/users.schema';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name)
    private readonly warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
  ) {}

  async create(
    data: Partial<Warehouse>,
    organization: Organization,
  ): Promise<WarehouseDocument> {
    const doc = new this.warehouseModel({ ...data, organization });
    return doc.save();
  }

  async findAll(organization: Organization): Promise<WarehouseDocument[]> {
    return this.warehouseModel.find({ organization }).exec();
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<WarehouseDocument> {
    const found = await this.warehouseModel
      .findOne({ _id: id, organization })
      .exec();
    if (!found) throw new NotFoundException('Warehouse not found');
    return found;
  }

  async update(
    id: string,
    data: Partial<Warehouse>,
    organization: Organization,
  ): Promise<WarehouseDocument> {
    const updated = await this.warehouseModel
      .findOneAndUpdate({ _id: id, organization }, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Warehouse not found');
    return updated;
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.warehouseModel
      .deleteOne({ _id: id, organization })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Warehouse not found');
    }
  }

  async inventory(id: string, organization: Organization) {
    await this.findOne(id, organization);
    return this.shipmentModel
      .find({ currentWarehouseId: id, organization, containerId: null })
      .exec();
  }
}
