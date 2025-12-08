import { IsString, IsNotEmpty } from 'class-validator';
import { IsGhanaPhone } from '../../common/validators/phone.validator';

export class PartnerSendOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsGhanaPhone()
  phoneNumber: string;
}
