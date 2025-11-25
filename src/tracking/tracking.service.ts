import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import {
  Container,
  ContainerDocument,
  ContainerStatus,
} from '../containers/containers.schema';

@Injectable()
export class TrackingService {
  constructor(
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    @InjectModel(Container.name)
    private readonly containerModel: Model<ContainerDocument>,
  ) {}

  async trackNumber(number: string, organization: string) {
    // Search for shipment first
    const shipment = await this.shipmentModel
      .findOne({ trackingNumber: number, organization })
      .exec();
    if (shipment) return { type: 'shipment', data: shipment };

    // Then search for container
    const container = await this.containerModel
      .findOne({ containerNumber: number, organization })
      .exec();
    if (container) return { type: 'container', data: container };

    return { type: 'unknown', data: null };
  }

  async activeContainers(organization: string) {
    const activeStatuses: ContainerStatus[] = [
      ContainerStatus.LOADING,
      ContainerStatus.LOADED,
      ContainerStatus.IN_TRANSIT,
    ];
    return this.containerModel
      .find({ status: { $in: activeStatuses }, organization })
      .exec();
  }

  async webhook(payload: any) {
    // Accept and persist carrier updates; for now, simply echo
    return { received: true };
  }
}
