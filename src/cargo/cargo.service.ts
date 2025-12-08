import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cargo, CargoDocument } from './cargo.schema';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';
import { Organization } from '../user/users.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';

@Injectable()
export class CargoService {
  constructor(
    @InjectModel(Cargo.name)
    private readonly cargoModel: Model<CargoDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
  ) {}

  private validateCustomerOrPartner(
    customerId?: string,
    partnerId?: string,
  ): void {
    if (!customerId && !partnerId) {
      throw new BadRequestException(
        'Either customerId or partnerId must be provided',
      );
    }
    if (customerId && partnerId) {
      throw new BadRequestException(
        'Only one of customerId or partnerId can be provided',
      );
    }
  }

  async create(dto: CreateCargoDto, organization: Organization) {
    this.validateCustomerOrPartner(dto.customerId, dto.partnerId);

    const etaDate = dto.eta ? new Date(dto.eta) : undefined;

    const cargo = new this.cargoModel({
      organization,
      cargoId: dto.cargoId,
      type: dto.type,
      weight: dto.weight,
      origin: dto.origin,
      destination: dto.destination,
      vesselName: dto.vesselName,
      eta: etaDate,
      containerId: dto.containerId
        ? new Types.ObjectId(dto.containerId)
        : undefined,
      customerId: dto.customerId
        ? new Types.ObjectId(dto.customerId)
        : undefined,
      partnerId: dto.partnerId ? new Types.ObjectId(dto.partnerId) : undefined,
    });

    return cargo.save();
  }

  async findAll(organization: Organization) {
    return this.cargoModel
      .find(buildOrganizationFilter(organization))
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOneWithPackages(id: string, organization: Organization) {
    const cargo = await this.cargoModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .populate('customerId', 'name email phone')
      .populate('partnerId', 'name email phoneNumber')
      .exec();

    if (!cargo) {
      throw new NotFoundException('Cargo not found');
    }

    // Find shipments (packages) related via the container, if any
    let packages: ShipmentDocument[] = [];
    if (cargo.containerId) {
      packages = await this.shipmentModel
        .find({
          containerId: cargo.containerId,
          ...buildOrganizationFilter(organization),
        })
        .populate('customerId', 'name email phone')
        .populate('partnerId', 'name email phoneNumber')
        .exec();
    }

    return {
      cargo,
      packages,
    };
  }

  async update(
    id: string,
    dto: UpdateCargoDto,
    organization: Organization,
  ): Promise<CargoDocument> {
    if (dto.customerId || dto.partnerId) {
      this.validateCustomerOrPartner(dto.customerId, dto.partnerId);
    }

    const etaDate = dto.eta ? new Date(dto.eta) : undefined;

    const updateData: any = {
      ...dto,
    };

    if (etaDate !== undefined) {
      updateData.eta = etaDate;
    }
    if (dto.containerId !== undefined) {
      updateData.containerId = dto.containerId
        ? new Types.ObjectId(dto.containerId)
        : undefined;
    }
    if (dto.customerId !== undefined) {
      updateData.customerId = dto.customerId
        ? new Types.ObjectId(dto.customerId)
        : undefined;
    }
    if (dto.partnerId !== undefined) {
      updateData.partnerId = dto.partnerId
        ? new Types.ObjectId(dto.partnerId)
        : undefined;
    }

    const cargo = await this.cargoModel
      .findOneAndUpdate(
        { _id: id, ...buildOrganizationFilter(organization) },
        updateData,
        {
          new: true,
        },
      )
      .exec();

    if (!cargo) {
      throw new NotFoundException('Cargo not found');
    }

    return cargo;
  }

  async delete(id: string, organization: Organization): Promise<void> {
    const result = await this.cargoModel
      .findOneAndDelete({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();
    if (!result) {
      throw new NotFoundException('Cargo not found');
    }
  }
}
