import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Container, ContainerDocument } from './containers.schema';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import {
  Shipment,
  ShipmentDocument,
  ShipmentStatus,
} from '../shipments/shipments.schema';
import { LoadShipmentsDto } from './dto/load-shipments.dto';
import { Organization } from '../user/users.schema';

@Injectable()
export class ContainersService {
  constructor(
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
  ) {}

  async create(
    dto: CreateContainerDto,
    organization: Organization,
  ): Promise<ContainerDocument> {
    const doc = new this.containerModel({ ...dto, organization });
    return doc.save();
  }

  async findAll(organization: Organization): Promise<ContainerDocument[]> {
    return this.containerModel.find({ organization }).exec();
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<ContainerDocument> {
    const found = await this.containerModel
      .findOne({ _id: id, organization })
      .exec();
    if (!found) throw new NotFoundException('Container not found');
    return found;
  }

  async update(
    id: string,
    dto: UpdateContainerDto,
    organization: Organization,
  ): Promise<ContainerDocument> {
    const updated = await this.containerModel
      .findOneAndUpdate({ _id: id, organization }, { $set: dto }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Container not found');
    return updated;
  }

  async loadShipments(
    containerId: string,
    dto: LoadShipmentsDto,
    organization: Organization,
  ) {
    const container = await this.findOne(containerId, organization);
    const shipments = await this.shipmentModel
      .find({ _id: { $in: dto.shipmentIds }, organization })
      .exec();

    if (shipments.length !== dto.shipmentIds.length) {
      throw new BadRequestException('One or more shipments not found');
    }

    await this.shipmentModel.updateMany(
      { _id: { $in: dto.shipmentIds }, organization },
      { $set: { containerId: container._id, status: ShipmentStatus.LOADED } },
    );

    return { loadedCount: shipments.length };
  }

  async listShipments(containerId: string, organization: Organization) {
    await this.findOne(containerId, organization);
    return this.shipmentModel.find({ containerId, organization }).exec();
  }

  async delete(id: string, organization: Organization): Promise<void> {
    // Check if container has shipments
    const shipmentsCount = await this.shipmentModel.countDocuments({
      containerId: id,
      organization,
    });

    if (shipmentsCount > 0) {
      throw new BadRequestException(
        'Cannot delete container with associated shipments. Please remove shipments first.',
      );
    }

    const result = await this.containerModel
      .deleteOne({ _id: id, organization })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Container not found');
    }
  }
}
