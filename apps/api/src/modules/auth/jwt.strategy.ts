// JWT verification is now handled by JwtAuthGuard using supabase.auth.getUser()
// This file is kept to avoid breaking the AuthModule imports
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy {}
