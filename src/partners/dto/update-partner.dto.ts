import { IsString, IsOptional, IsEmail } from 'class-validator';
import { IsGhanaPhone } from '../../common/validators/phone.validator';

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  businessRegistrationNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsGhanaPhone()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;
}
