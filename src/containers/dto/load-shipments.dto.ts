import { IsArray, IsMongoId } from 'class-validator';

export class LoadShipmentsDto {
  @IsArray()
  @IsMongoId({ each: true })
  shipmentIds: string[];
}
