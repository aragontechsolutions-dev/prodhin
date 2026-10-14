import { IsUUID } from 'class-validator';

export class AssignCustomerDto {
  @IsUUID()
  driver_id: string;

  @IsUUID()
  customer_id: string;
}
