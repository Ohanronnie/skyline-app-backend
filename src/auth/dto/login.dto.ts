import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Organization } from '../../user/users.schema';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Organization)
  organization: Organization;
}
