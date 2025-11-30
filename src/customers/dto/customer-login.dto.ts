import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Organization } from '../../user/users.schema';

export class CustomerLoginDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsEnum(Organization)
  organization: Organization;
}
