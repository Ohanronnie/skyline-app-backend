import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsEmail,
  IsOptional,
} from 'class-validator';
import { Organization } from '../../user/users.schema';
import { IsGhanaPhone } from '../../common/validators/phone.validator';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsGhanaPhone()
  phoneNumber: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(Organization)
  organization: Organization;
}
