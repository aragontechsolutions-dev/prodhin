import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsEmail,
  ValidateIf,
} from 'class-validator';

enum CustomerType {
  empresa = 'empresa',
  persona_fisica = 'persona_fisica',
}

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  customer_type: CustomerType;

  @ValidateIf((o) => o.customer_type === 'persona_fisica')
  @IsString()
  first_name?: string | null;

  @ValidateIf((o) => o.customer_type === 'persona_fisica')
  @IsString()
  last_name?: string | null;

  @ValidateIf((o) => o.customer_type === 'empresa')
  @IsString()
  business_name?: string | null;

  @IsString()
  @IsOptional()
  tax_id?: string | null;

  @IsString()
  @IsOptional()
  contact_name?: string | null;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsString()
  address: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
