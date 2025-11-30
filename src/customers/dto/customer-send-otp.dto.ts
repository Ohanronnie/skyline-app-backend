import { IsString, IsNotEmpty } from 'class-validator';

export class CustomerSendOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
