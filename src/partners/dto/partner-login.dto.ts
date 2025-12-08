import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Organization } from '../../user/users.schema';
import { IsGhanaPhone } from '../../common/validators/phone.validator';

export class PartnerLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsGhanaPhone()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsEnum(Organization)
  organization: Organization;
}
