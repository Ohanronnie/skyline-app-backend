import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import {
  Container,
  ContainerDocument,
  ContainerStatus,
} from '../containers/containers.schema';
import { Tracking, TrackingDocument } from './tracking.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';
import { Organization } from '../user/users.schema';

@Injectable()
export class TrackingService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
    @InjectModel(Tracking.name)
    private readonly trackingModel: Model<TrackingDocument>,
  ) {}

  async trackNumber(number: string, organization: Organization) {
    // console.log(await this.trackingModel.find({}).exec());
    const trackingEntries = await this.trackingModel
      .find({ trackingNumber: number })
      .sort({ createdAt: 1 })
      .exec();
    // Search for shipment first
    const shipment = await this.shipmentModel
      .findOne({
        trackingNumber: number,
        ...buildOrganizationFilter(organization),
      })
      .exec();
    if (shipment)
      return {
        type: 'shipment',
        data: shipment,
        tracking: trackingEntries,
      };

    // Then search for container
    const container = await this.containerModel
      .findOne({
        containerNumber: number,
        ...buildOrganizationFilter(organization),
      })
      .exec();
    if (container)
      return {
        type: 'container',
        data: container,
        tracking: trackingEntries,
      };

    return { type: 'unknown', data: null, tracking: trackingEntries };
  }

  async activeContainers(organization: Organization) {
    const activeStatuses: ContainerStatus[] = [
      ContainerStatus.LOADING,
      ContainerStatus.LOADED,
      ContainerStatus.IN_TRANSIT,
    ];
    return this.containerModel
      .find({
        status: { $in: activeStatuses },
        ...buildOrganizationFilter(organization),
      })
      .exec();
  }

  async webhook(payload: any) {
    // Accept and persist carrier updates; for now, simply echo
    return { received: true };
  }
}
