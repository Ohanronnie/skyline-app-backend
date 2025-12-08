import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerType, CustomerLocation } from '../customers.schema';
import { IsGhanaPhone } from '../../common/validators/phone.validator';

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
  @IsGhanaPhone()
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
