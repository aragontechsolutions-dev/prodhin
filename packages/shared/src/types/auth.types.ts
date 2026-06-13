export type UserRole = 'admin' | 'chofer';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
  };
}
