import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './customers.schema';
import { Shipment, ShipmentDocument } from '../shipments/shipments.schema';
import { Organization } from '../user/users.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
  ) {}

  async create(
    data: Partial<Customer>,
    organization: Organization,
    partnerId?: string,
  ): Promise<CustomerDocument> {
    const doc = new this.customerModel({ ...data, organization, partnerId });
    return doc.save();
  }

  async findAll(organization: Organization, partnerId?: string): Promise<CustomerDocument[]> {
    const filter: any = { organization };
    if (partnerId) {
      filter.partnerId = partnerId;
    }
    return this.customerModel.find(filter).exec();
  }

  async findOne(
    id: string,
    organization: Organization,
  ): Promise<CustomerDocument> {
    const found = await this.customerModel
      .findOne({ _id: id, organization })
      .exec();
    if (!found) throw new NotFoundException('Customer not found');
    return found;
  }

  async findByEmail(
    email: string,
    organization: Organization,
  ): Promise<CustomerDocument | null> {
    return this.customerModel
      .findOne({ email: email.toLowerCase(), organization })
      .exec();
  }

  async update(
    id: string,
    data: Partial<Customer>,
    organization: Organization,
  ): Promise<CustomerDocument> {
    const updated = await this.customerModel
      .findOneAndUpdate(
        { _id: id, organization },
        { $set: data },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Customer not found');
    return updated;
  }

  async shipments(
    id: string,
    organization: Organization,
  ): Promise<ShipmentDocument[]> {
    await this.findOne(id, organization);
    return this.shipmentModel.find({ customerId: id, organization }).exec();
  }

  async search(
    query: string,
    organization: Organization,
  ): Promise<CustomerDocument[]> {
    // Sanitize input to prevent ReDoS attacks
    const sanitized = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      organization,
      $or: [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
        { phone: { $regex: sanitized, $options: 'i' } },
      ],
    };
    return this.customerModel.find(filter).exec();
  }
}
