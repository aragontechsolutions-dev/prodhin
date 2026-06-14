import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private supabase;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    if (typeof globalThis.WebSocket === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      globalThis.WebSocket = require('ws');
    }
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = authHeader.slice(7);

    const { data: { user }, error } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const profile = await this.prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile || !profile.isActive) {
      throw new UnauthorizedException('Usuario no autorizado o inactivo');
    }

    request.user = {
      id: profile.id,
      email: user.email,
      role: profile.role,
      fullName: profile.fullName,
    };

    return true;
  }
}
