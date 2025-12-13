import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { Customer, CustomerDocument } from '../customers/customers.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';

@Injectable()
export class ContainersService {
  constructor(
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  async create(
    dto: CreateContainerDto,
    organization: Organization,
  ): Promise<ContainerDocument> {
    const doc = new this.containerModel({ ...dto, organization });
    return doc.save();
  }

  async findAll(
    organization: Organization,
    partnerId?: string,
  ): Promise<any[]> {
    let containers: ContainerDocument[];

    if (partnerId) {
      // Find containers that have shipments belonging to this partner
      const shipments = await this.shipmentModel
        .find({
          partnerId: partnerId,
          ...buildOrganizationFilter(organization),
        })
        .select('containerId')
        .exec();

      const containerIds = [
        ...new Set(
          shipments
            .map((s) => s.containerId?.toString())
            .filter((id): id is string => id !== undefined),
        ),
      ];

      if (containerIds.length === 0) {
        return [];
      }

      containers = await this.containerModel
        .find({
          _id: { $in: containerIds },
          ...buildOrganizationFilter(organization),
        })
        .populate('customerId', 'name email phone location type')
        .populate('partnerCustomerId', 'name email phone location type')
        .exec();
    } else {
      containers = await this.containerModel
        .find(buildOrganizationFilter(organization))
        .populate('customerId', 'name email phone location type')
        .populate('partnerCustomerId', 'name email phone location type')
        .exec();
    }

    // Get shipments and customers for each container
    return Promise.all(
      containers.map(async (container) => {
        // Get shipment count
        const shipmentCount = await this.shipmentModel
          .countDocuments({
            containerId: container._id.toString(),
            ...buildOrganizationFilter(organization),
          })
          .exec();

        // Get shipments for this container
        const shipments = await this.shipmentModel
          .find({
            containerId: container._id.toString(),
            ...buildOrganizationFilter(organization),
          })
          .populate('customerId', 'name email phone location type')
          .populate('partnerId', 'name phone email')
          .exec();
        // Get unique customers from shipments
        const customerIds = [
          ...new Set(
            shipments
              .map((s) => {
                if (!s.customerId) return null;
                // If populated (object), extract _id; otherwise use the value directly
                const customerId: any = s.customerId;
                if (typeof customerId === 'object' && '_id' in customerId) {
                  return customerId._id.toString();
                }
                return customerId.toString();
              })
              .filter((id): id is string => id !== null && id !== undefined),
          ),
        ];

        const customers =
          customerIds.length > 0
            ? await this.customerModel
                .find({
                  _id: { $in: customerIds },
                  ...buildOrganizationFilter(organization),
                })
                .select('name email phone location type')
                .exec()
            : [];

        // If container has a direct customerId, include it
        if (container.customerId) {
          const directCustomer = await this.customerModel
            .findById(container.customerId)
            .select('name email phone location type')
            .exec();
          if (
            directCustomer &&
            !customers.some(
              (c) => c._id.toString() === directCustomer._id.toString(),
            )
          ) {
            customers.push(directCustomer);
          }
        }

        // shipmentCount already calculated above

        // Get customer (usually 1, but could be multiple from shipments or direct assignment)
        const customer = customers.length > 0 ? customers[0] : undefined;

        return {
          ...container.toObject(),
          shipments,
          shipmentCount,
          customer,
          customers: customers.length > 0 ? customers : undefined,
        };
      }),
    );
  }

  async findOne(id: string, organization: Organization): Promise<any> {
    const container = await this.containerModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .populate('customerId', 'name email phone location type')
      .populate('partnerCustomerId', 'name email phone location type')
      .exec();
    if (!container) throw new NotFoundException('Container not found');

    // Get shipment count
    const shipmentCount = await this.shipmentModel
      .countDocuments({
        containerId: container._id.toString(),
        ...buildOrganizationFilter(organization),
      })
      .exec();

    // Get shipments for this container
    const shipments = await this.shipmentModel
      .find({
        containerId: container._id.toString(),
        ...buildOrganizationFilter(organization),
      })
      .populate('customerId', 'name email phone location type')
      .populate('partnerId', 'name phone email')
      .exec();

    // Get unique customers from shipments
    const customerIds = [
      ...new Set(
        shipments
          .map((s) => {
            if (!s.customerId) return null;
            // If populated (object), extract _id; otherwise use the value directly
            const customerId: any = s.customerId;
            if (typeof customerId === 'object' && '_id' in customerId) {
              return customerId._id.toString();
            }
            return customerId.toString();
          })
          .filter((id): id is string => id !== null && id !== undefined),
      ),
    ];

    const customers =
      customerIds.length > 0
        ? await this.customerModel
            .find({
              _id: { $in: customerIds },
              ...buildOrganizationFilter(organization),
            })
            .select('name email phone location type')
            .exec()
        : [];

    // If container has a direct customerId, include it
    if (container.customerId) {
      const directCustomer = await this.customerModel
        .findById(container.customerId)
        .select('name email phone location type')
        .exec();
      if (
        directCustomer &&
        !customers.some(
          (c) => c._id.toString() === directCustomer._id.toString(),
        )
      ) {
        customers.push(directCustomer);
      }
    }

    // shipmentCount already calculated above

    // Get customer (usually 1, but could be multiple from shipments or direct assignment)
    const customer = customers.length > 0 ? customers[0] : undefined;

    return {
      ...container.toObject(),
      shipments,
      shipmentCount,
      customer,
      customers: customers.length > 0 ? customers : undefined,
    };
  }

  async update(
    id: string,
    dto: UpdateContainerDto,
    organization: Organization,
    userRole?: string,
    userId?: string,
  ): Promise<ContainerDocument> {
    const existing = await this.containerModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (!existing) {
      throw new NotFoundException('Container not found');
    }

    // Prevent changing existing partnerId assignment
    if (existing.partnerId) {
      if (dto.partnerId && dto.partnerId !== existing.partnerId.toString()) {
        throw new BadRequestException(
          'Cannot change partner assignment once a container is assigned to a partner',
        );
      }
      // Partners can only modify their own containers
      if (userRole === 'partner' && userId !== existing.partnerId.toString()) {
        throw new BadRequestException(
          'You can only modify containers assigned to you',
        );
      }
    }

    // Prevent changing existing customerId assignment (admin's customer)
    if (existing.customerId) {
      if (dto.customerId && dto.customerId !== existing.customerId.toString()) {
        throw new BadRequestException(
          'Cannot change customer assignment once a container is assigned to a customer',
        );
      }
    }

    const updateData = { ...dto };
    // If user is a partner, they can only modify partnerCustomerId, not customerId or partnerId
    if (userRole === 'partner') {
      delete updateData.partnerId;
      delete updateData.customerId;
      // Partners can only set partnerCustomerId
    }

    const updated = await this.containerModel
      .findOneAndUpdate(
        { _id: id, ...buildOrganizationFilter(organization) },
        { $set: updateData },
        { new: true },
      )
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
      .find({
        _id: { $in: dto.shipmentIds },
        ...buildOrganizationFilter(organization),
      })
      .exec();

    if (shipments.length !== dto.shipmentIds.length) {
      throw new BadRequestException('One or more shipments not found');
    }

    await this.shipmentModel.updateMany(
      {
        _id: { $in: dto.shipmentIds },
        ...buildOrganizationFilter(organization),
      },
      { $set: { containerId: container._id, status: ShipmentStatus.LOADED } },
    );

    return { loadedCount: shipments.length };
  }

  async listShipments(containerId: string, organization: Organization) {
    await this.findOne(containerId, organization);
    return this.shipmentModel
      .find({ containerId, ...buildOrganizationFilter(organization) })
      .exec();
  }

  async assignCustomer(
    containerId: string,
    customerId: string | null,
    organization: Organization,
    userRole?: string,
    userId?: string,
  ): Promise<ContainerDocument> {
    const container = await this.containerModel
      .findOne({ _id: containerId, ...buildOrganizationFilter(organization) })
      .exec();
    if (!container) {
      throw new NotFoundException('Container not found');
    }

    // If partner, verify container is assigned to them
    if (userRole === 'partner') {
      if (!container.partnerId) {
        throw new BadRequestException(
          'Container must be assigned to a partner before assigning a customer',
        );
      }
      if (userId !== container.partnerId.toString()) {
        throw new BadRequestException(
          'You can only assign customers to containers assigned to you',
        );
      }
    }

    // Prevent assigning customer if container already has one (unless removing)
    if (
      container.customerId &&
      customerId &&
      customerId !== container.customerId.toString()
    ) {
      throw new BadRequestException(
        'Container already has a customer assigned. Cannot change customer assignment.',
      );
    }

    // Prevent assigning customer if container has partnerId and admin is trying to assign
    if (userRole !== 'partner' && container.partnerId && customerId) {
      throw new BadRequestException(
        'Cannot assign customer to a container that is already assigned to a partner. Partner must assign the customer.',
      );
    }

    if (customerId) {
      // Verify customer exists
      const customer = await this.customerModel
        .findOne({ _id: customerId, ...buildOrganizationFilter(organization) })
        .exec();
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
    }

    const updated = await this.containerModel
      .findOneAndUpdate(
        { _id: containerId, ...buildOrganizationFilter(organization) },
        { $set: { customerId: customerId || null } },
        { new: true },
      )
      .populate('customerId', 'name email phone location type')
      .exec();

    if (!updated) {
      throw new NotFoundException('Container not found');
    }

    return updated;
  }

  async delete(id: string, organization: Organization): Promise<void> {
    // Check if container has shipments
    const shipmentsCount = await this.shipmentModel.countDocuments({
      containerId: id,
      ...buildOrganizationFilter(organization),
    });

    if (shipmentsCount > 0) {
      throw new BadRequestException(
        'Cannot delete container with associated shipments. Please remove shipments first.',
      );
    }

    const result = await this.containerModel
      .deleteOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Container not found');
    }
  }
}
