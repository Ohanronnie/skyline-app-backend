import { Injectable } from '@nestjs/common';
import { UserRole } from '../user/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Warehouse, WarehouseDocument } from '../warehouses/warehouses.schema';

export interface UserContext {
  userId: string;
  role: UserRole;
  warehouseId?: string | null;
}

@Injectable()
export class LocationFilterService {
  constructor(
    @InjectModel(Warehouse.name)
    private readonly warehouseModel: Model<WarehouseDocument>,
  ) {}

  async canAccessWarehouse(
    user: UserContext,
    warehouseId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN) return true;
    return user.warehouseId === warehouseId;
  }

  async getAccessibleWarehouseIds(user: UserContext): Promise<string[]> {
    if (user.role === UserRole.ADMIN) {
      const warehouses = await this.warehouseModel.find().select('_id').exec();
      return warehouses.map((w) => w._id.toString());
    }
    return user.warehouseId ? [user.warehouseId] : [];
  }

  async getUserLocation(user: UserContext): Promise<string | null> {
    if (user.role === UserRole.ADMIN) return null;
    if (!user.warehouseId) return null;
    const warehouse = await this.warehouseModel
      .findById(user.warehouseId)
      .exec();
    return warehouse?.location ?? null;
  }

  isAdmin(user: UserContext): boolean {
    return user.role === UserRole.ADMIN;
  }
}
