import { IsEmail } from 'class-validator';

export class CustomerRequestCodeDto {
  @IsEmail()
  email: string;
}


