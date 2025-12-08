import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AccessPartnerDto {
  @IsMongoId()
  @IsNotEmpty()
  partnerId: string;
}
