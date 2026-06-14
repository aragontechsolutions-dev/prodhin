import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

enum UserRole {
  admin = 'admin',
  chofer = 'chofer',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  full_name: string;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsEnum(UserRole)
  role: UserRole;

  @IsBoolean()
  @IsOptional()
  email_confirmed?: boolean;

  @IsBoolean()
  @IsOptional()
  must_change_password?: boolean;
}
