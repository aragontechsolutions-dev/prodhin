import type { UserRole } from './auth.types';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: UserRole;
}

export interface UpdateUserDto {
  full_name?: string;
  phone?: string;
  role?: UserRole;
  is_active?: boolean;
}
