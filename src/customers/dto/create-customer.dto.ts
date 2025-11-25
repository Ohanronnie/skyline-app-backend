import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerType, CustomerLocation } from '../customers.schema';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsEnum(CustomerType)
  type: CustomerType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEnum(CustomerLocation)
  location: CustomerLocation;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
