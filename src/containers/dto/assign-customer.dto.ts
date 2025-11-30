import { IsMongoId, IsOptional } from 'class-validator';

export class AssignCustomerDto {
  @IsOptional()
  @IsMongoId()
  customerId?: string;
}

