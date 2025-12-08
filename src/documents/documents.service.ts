import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentFile, DocumentFileDocument } from './documents.schema';
import { Organization } from '../user/users.schema';
import { buildOrganizationFilter } from '../auth/organization-filter.util';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentFile.name)
    private readonly documentModel: Model<DocumentFileDocument>,
  ) {}

  async create(data: Partial<DocumentFile>, organization: Organization) {
    const doc = new this.documentModel({ ...data, organization });
    return doc.save();
  }

  async findAll(organization: Organization) {
    return this.documentModel
      .find(buildOrganizationFilter(organization))
      .populate('shipmentId', 'trackingNumber')
      .exec();
  }

  async findOne(id: string, organization: Organization) {
    const found = await this.documentModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();
    if (!found) throw new NotFoundException('Document not found');
    return found;
  }

  async remove(id: string, organization: Organization) {
    const res = await this.documentModel
      .findOneAndDelete({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();
    if (!res) throw new NotFoundException('Document not found');
    return { deleted: true };
  }

  async forShipment(id: string, organization: Organization) {
    return this.documentModel
      .find({ shipmentId: id, ...buildOrganizationFilter(organization) })
      .exec();
  }

  async forContainer(id: string, organization: Organization) {
    return this.documentModel
      .find({ containerId: id, ...buildOrganizationFilter(organization) })
      .exec();
  }
}
