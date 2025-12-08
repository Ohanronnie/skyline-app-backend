import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from './warehouses.schema';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { Organization } from '../user/users.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';

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

  async findAll(organization: Organization): Promise<any[]> {
    const warehouses = await this.warehouseModel
      .find(buildOrganizationFilter(organization))
      .exec();

    // Get shipments and counts for each warehouse
    const results = await Promise.all(
      warehouses.map(async (warehouse) => {
        console.log(warehouse._id.toString());
        const shipments = await this.shipmentModel
          .find({
            currentWarehouseId: warehouse._id.toString(),
            ...buildOrganizationFilter(organization),
          //  containerId: null,
          })
          .populate('customerId', 'name phone email location')
          .populate('partnerId', 'name phone email')
          .exec();

        const shipmentCount = shipments.length;
       // console.log(shipments);
        return {
          ...warehouse.toObject(),
          shipments,
          shipmentCount,
        };
      }),
    );
    console.log(results);
    return results;
  }

  async findOne(id: string, organization: Organization): Promise<any> {
    const found = await this.warehouseModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();
    if (!found) throw new NotFoundException('Warehouse not found');

    // Get shipments currently in this warehouse
    const shipments = await this.shipmentModel
      .find({
        currentWarehouseId: id.toString(),
        ...buildOrganizationFilter(organization),
        //containerId: null,
      })
      .populate('customerId', 'name phone email location')
      .populate('partnerId', 'name phone email')
      .exec();

    const shipmentCount = shipments.length;

    return {
      ...found.toObject(),
      shipments,
      shipmentCount,
    };
  }

  async update(
    id: string,
    data: Partial<Warehouse>,
    organization: Organization,
  ): Promise<WarehouseDocument> {
    const updated = await this.warehouseModel
      .findOneAndUpdate(
        { _id: id, ...buildOrganizationFilter(organization) },
        data,
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Warehouse not found');
    return updated;
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.warehouseModel
      .deleteOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Warehouse not found');
    }
  }

  async inventory(id: string, organization: Organization) {
    await this.findOne(id, organization);
    return this.shipmentModel
      .find({
        currentWarehouseId: id,
        ...buildOrganizationFilter(organization),
        containerId: null,
      })
      .exec();
  }
}
