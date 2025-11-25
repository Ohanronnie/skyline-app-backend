import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Organization } from '../../user/users.schema';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEnum(Organization)
  organization: Organization;
}
