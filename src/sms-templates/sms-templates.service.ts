import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SmsTemplate, SmsTemplateDocument } from './sms-templates.schema';
import { Organization } from '../user/users.schema';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { buildOrganizationFilter } from '../auth/organization-filter.util';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { ShipmentStatus } from '../shipments/shipments.schema';

@Injectable()
export class SmsTemplatesService implements OnModuleInit {
  constructor(
    @InjectModel(SmsTemplate.name)
    private smsTemplateModel: Model<SmsTemplateDocument>,
  ) {}

  async onModuleInit() {
    // Drop all old problematic indexes to ensure clean slate
    try {
      await this.smsTemplateModel.collection.dropIndex('name_1');
    } catch (e) {}
    try {
      await this.smsTemplateModel.collection.dropIndex(
        'organization_1_partnerId_1_name_1',
      );
    } catch (e) {}
    try {
      await this.smsTemplateModel.collection.dropIndex(
        'organization_1_userId_1_name_1',
      );
    } catch (e) {}
    console.log('Cleaned up old SMS template indexes');
  }

  async removeAllDefaultTemplates(): Promise<void> {
    await this.smsTemplateModel
      .deleteMany({
        isDefault: true,
        partnerId: null,
        userId: null,
      })
      .exec();
  }

  // Helper to construct the owner query part
  private getOwnerQuery(partnerId?: string, userId?: string) {
    if (partnerId) {
      return {
        partnerId: new Types.ObjectId(partnerId),
        userId: { $exists: false },
      };
    }
    if (userId) {
      return {
        userId: new Types.ObjectId(userId),
        partnerId: { $exists: false },
      };
    }
    // For default templates (no owner), both should be null and isDefault should be true
    return { isDefault: true, partnerId: null, userId: null };
  }

  async create(
    dto: CreateSmsTemplateDto,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument> {
    // 1. Check if a template with this name already exists for this specific owner
    const ownerQuery = this.getOwnerQuery(partnerId, userId);
    const existing = await this.smsTemplateModel
      .findOne({
        name: dto.name,
        ...buildOrganizationFilter(organization),
        ...ownerQuery,
      })
      .exec();

    if (existing) {
      throw new ConflictException(
        `Template with name "${dto.name}" already exists for this user`,
      );
    }

    // 2. Create the template
    const template = new this.smsTemplateModel({
      ...dto,
      organization,
      partnerId: partnerId ? new Types.ObjectId(partnerId) : undefined,
      userId: userId ? new Types.ObjectId(userId) : undefined,
      isDefault: !partnerId && !userId, // If no owner, it's a default template
      isActive: dto.isActive ?? true,
    });

    return template.save();
  }

  async findAll(
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument[]> {
    // 1. Get all default templates
    const defaultTemplates = await this.smsTemplateModel
      .find({
        ...buildOrganizationFilter(organization),
        isDefault: true,
      })
      .exec();

    // 2. If no specific user, just return defaults
    if (!partnerId && !userId) {
      return defaultTemplates.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 3. Get user's custom templates
    const ownerQuery = this.getOwnerQuery(partnerId, userId);
    const customTemplates = await this.smsTemplateModel
      .find({
        ...buildOrganizationFilter(organization),
        ...ownerQuery,
      })
      .exec();

    // 4. Merge: Create a map of name -> template.
    // Start with defaults, then overwrite with customs.
    const templateMap = new Map<string, SmsTemplateDocument>();

    defaultTemplates.forEach((t) => templateMap.set(t.name, t));
    customTemplates.forEach((t) => templateMap.set(t.name, t));

    return Array.from(templateMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async findOne(
    id: string,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument> {
    const template = await this.smsTemplateModel
      .findOne({ _id: id, ...buildOrganizationFilter(organization) })
      .exec();

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Security check: ensure the user has access to this template
    if (partnerId) {
      if (
        template.partnerId &&
        template.partnerId.toString() !== partnerId &&
        !template.isDefault
      ) {
        throw new NotFoundException('Template not found');
      }
    } else if (userId) {
      if (
        template.userId &&
        template.userId.toString() !== userId &&
        !template.isDefault
      ) {
        throw new NotFoundException('Template not found');
      }
    }

    return template;
  }

  async findByName(
    name: string,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument | null> {
    // 1. Try to find custom template
    if (partnerId || userId) {
      const ownerQuery = this.getOwnerQuery(partnerId, userId);
      const custom = await this.smsTemplateModel
        .findOne({
          name,
          ...buildOrganizationFilter(organization),
          ...ownerQuery,
          isActive: true,
        })
        .exec();

      if (custom) return custom;
    }

    // 2. Fallback to default
    return this.smsTemplateModel
      .findOne({
        name,
        ...buildOrganizationFilter(organization),
        isDefault: true,
        isActive: true,
      })
      .exec();
  }

  async findByStatus(
    status: ShipmentStatus,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument | null> {
    // 1. Try to find custom template
    if (partnerId || userId) {
      const ownerQuery = this.getOwnerQuery(partnerId, userId);
      const custom = await this.smsTemplateModel
        .findOne({
          ...buildOrganizationFilter(organization),
          statusMapping: { $in: [status] }, // statusMapping is an array
          ...ownerQuery,
          isActive: true,
        })
        .exec();

      if (custom) return custom;
    }

    // 2. Fallback to default
    return this.smsTemplateModel
      .findOne({
        ...buildOrganizationFilter(organization),
        statusMapping: { $in: [status] }, // statusMapping is an array
        isDefault: true,
        isActive: true,
      })
      .exec();
  }

  async update(
    id: string,
    dto: UpdateSmsTemplateDto,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<SmsTemplateDocument> {
    // 1. Find the target template
    const template = await this.findOne(id, organization, partnerId, userId);

    // 2. If it's a default template and we are a specific user -> Create a Copy
    if (template.isDefault && (partnerId || userId)) {
      // Check if we already have a custom copy (race condition check)
      const ownerQuery = this.getOwnerQuery(partnerId, userId);
      const existingCopy = await this.smsTemplateModel
        .findOne({
          name: template.name,
          ...buildOrganizationFilter(organization),
          ...ownerQuery,
        })
        .exec();

      if (existingCopy) {
        // Update the existing copy instead
        return this.update(
          existingCopy._id.toString(),
          dto,
          organization,
          partnerId,
          userId,
        );
      }

      // Create new copy
      const newTemplate = new this.smsTemplateModel({
        name: template.name,
        title: dto.title ?? template.title,
        content: dto.content ?? template.content,
        statusMapping: dto.statusMapping ?? template.statusMapping,
        organization,
        partnerId: partnerId ? new Types.ObjectId(partnerId) : undefined,
        userId: userId ? new Types.ObjectId(userId) : undefined,
        isDefault: false,
        isActive: dto.isActive ?? template.isActive,
      });

      return newTemplate.save();
    }

    // 3. If it's our own template -> Update it
    // (We know it's ours because findOne checks access, and we handled the isDefault case above)
    const updated = await this.smsTemplateModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!updated) throw new NotFoundException('Template not found');
    return updated;
  }

  async delete(
    id: string,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<void> {
    const template = await this.findOne(id, organization, partnerId, userId);

    // If it's a default template, users can't delete it.
    // However, if they "delete" a default template, maybe they mean "revert to system default"?
    // But since they don't have a copy, they are effectively using the system default.
    // So "deleting" a default template as a user should probably just do nothing or throw.
    if (template.isDefault && (partnerId || userId)) {
      throw new BadRequestException('Cannot delete default system templates');
    }

    // If it's their own template, delete it (this effectively reverts to default if one exists)
    await this.smsTemplateModel.findByIdAndDelete(id).exec();
  }

  renderTemplate(
    template: SmsTemplateDocument,
    variables: Record<string, any>,
  ): string {
    let rendered = template.content;
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    rendered = rendered.replace(placeholderRegex, (match, varName) => {
      const value = variables[varName];
      return value !== undefined && value !== null ? String(value) : match;
    });
    return rendered;
  }

  async renderTemplateByName(
    templateName: string,
    variables: Record<string, any>,
    organization: Organization,
    partnerId?: string,
    userId?: string,
  ): Promise<string> {
    const template = await this.findByName(
      templateName,
      organization,
      partnerId,
      userId,
    );

    if (!template) {
      throw new NotFoundException(`Template "${templateName}" not found`);
    }

    return this.renderTemplate(template, variables);
  }
}
