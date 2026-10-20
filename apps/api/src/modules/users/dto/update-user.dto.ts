import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

enum UserRole {
  admin = 'admin',
  chofer = 'chofer',
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  must_change_password?: boolean;
}
