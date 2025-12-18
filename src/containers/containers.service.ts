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
import { AssignCustomerDto } from './dto/assign-customer.dto';
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
    // Merge single + array fields for backward compatibility
    const customerIds = this.mergeIds(dto.customerId, dto.customerIds);
    const partnerIds = this.mergeIds(dto.partnerId, dto.partnerIds);

    // Initialize partnerAssignments if partnerId and partnerCustomerId provided
    const partnerAssignments: Array<{ partnerId: string; customerId: string }> = [];  
    if (dto.partnerId && dto.partnerCustomerId) {
      partnerAssignments.push({
        partnerId: dto.partnerId,
        customerId: dto.partnerCustomerId
      });
    }

    const doc = new this.containerModel({
      ...dto,
      organization,
      customerIds,
      partnerIds,
      partnerAssignments,
      // Store first ID in legacy fields for backward compat
      customerId: customerIds[0] || null,
      partnerId: partnerIds[0] || null,
    });
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
        .populate('customerIds', 'name email phone location type')
        .populate('partnerId', 'name phone email')
        .populate('partnerIds', 'name phone email')
        .populate('partnerCustomerId', 'name email phone location type')
        .populate('partnerAssignments.partnerId', 'name phone email')
        .populate('partnerAssignments.customerId', 'name email phone location type')
        .sort({ createdAt: -1 })
        .exec();
    } else {
      containers = await this.containerModel
        .find(buildOrganizationFilter(organization))
        .populate('customerId', 'name email phone location type')
        .populate('customerIds', 'name email phone location type')
        .populate('partnerId', 'name phone email')
        .populate('partnerIds', 'name phone email')
        .populate('partnerCustomerId', 'name email phone location type')
        .populate('partnerAssignments.partnerId', 'name phone email')
        .populate('partnerAssignments.customerId', 'name email phone location type')
        .sort({ createdAt: -1 })
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
      .populate('customerIds', 'name email phone location type')
      .populate('partnerId', 'name phone email')
      .populate('partnerIds', 'name phone email')
      .populate('partnerCustomerId', 'name email phone location type')
      .populate('partnerAssignments.partnerId', 'name phone email')
      .populate('partnerAssignments.customerId', 'name email phone location type')
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
      const assignments = existing.partnerAssignments || [];
      const idx = assignments.findIndex(a => a.partnerId === dto.partnerId);
      
      if (idx > -1) {
        assignments[idx].customerId = dto.partnerCustomerId;
      } else {
        assignments.push({
          partnerId: dto.partnerId,
          customerId: dto.partnerCustomerId
        });
      }
      
      updateData.partnerAssignments = assignments;
    }
    
    // If user is a partner, manage their partnerAssignments instead of main fields
    if (userRole === 'partner' && userId) {
      // Partners may send customerId instead of partnerCustomerId
      const customerIdToUse = dto.partnerCustomerId || dto.customerId;
      
      // Partner managing their specific assignment
      const assignments = existing.partnerAssignments || [];
      const idx = assignments.findIndex(a => a.partnerId === userId);
      
      if (customerIdToUse) {
        if (idx > -1) {
          assignments[idx].customerId = customerIdToUse;
        } else {
          assignments.push({ partnerId: userId, customerId: customerIdToUse });
        }
        updateData.partnerAssignments = assignments;
        updateData.partnerCustomerId = customerIdToUse; // Also update legacy field
      } else if (idx > -1 && ('partnerCustomerId' in dto || 'customerId' in dto) && !customerIdToUse) {
        // Remove assignment if explicitly set to null/undefined
        assignments.splice(idx, 1);
        updateData.partnerAssignments = assignments;
        updateData.partnerCustomerId = null;
      }
      
      // Partners cannot modify admin's fields
      delete updateData.partnerId;
      delete updateData.customerId;
      delete updateData.customerIds;
      delete updateData.partnerIds;
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
    dto: AssignCustomerDto,
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

    // Prevent assigning customer if container has partnerId and admin is trying to assign
    if (userRole !== 'partner' && container.partnerId && dto.customerId) {
      throw new BadRequestException(
        'Cannot assign customer to a container that is already assigned to a partner. Partner must assign the customer.',
      );
    }

    const updateQuery: any = { $set: {} };
    if (userRole === 'partner' && userId) {
      // Partner managing their specific assignment
      const assignments = container.partnerAssignments || [];
      const idx = assignments.findIndex(a => a.partnerId === userId);
      
      if (dto.customerId) {
        if (idx > -1) {
          assignments[idx].customerId = dto.customerId;
        } else {
          assignments.push({ partnerId: userId, customerId: dto.customerId });
        }
      } else if (idx > -1) {
        assignments.splice(idx, 1);
      }
      
      updateQuery.$set.partnerAssignments = assignments;
      updateQuery.$set.partnerCustomerId = assignments.length > 0 ? assignments[0].customerId : null;
    } else {
      // Admin path - simple single assignment
      updateQuery.$set.customerId = dto.customerId || null;
      updateQuery.$set.customerIds = dto.customerId ? [dto.customerId] : [];
    }

    const updated = await this.containerModel
      .findOneAndUpdate(
        { _id: containerId, ...buildOrganizationFilter(organization) },
        updateQuery,
        { new: true },
      )
      .populate('customerId', 'name email phone location type')
      .populate('customerIds', 'name email phone location type')
      .populate('partnerId', 'name phone email')
      .populate('partnerCustomerId', 'name email phone location type')
      .populate('partnerAssignments.partnerId', 'name phone email')
      .populate('partnerAssignments.customerId', 'name email phone location type')
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

  // Helper method to merge single ID and array of IDs (Phase 1 migration)
  private mergeIds(single?: string, array?: string[]): string[] {
    const ids = new Set<string>();
    if (single) ids.add(single);
    if (array) array.forEach(id => ids.add(id));
    return Array.from(ids);
  }
}
