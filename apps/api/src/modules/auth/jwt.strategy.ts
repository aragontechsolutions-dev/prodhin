import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: payload.sub },
    });

    if (!profile || !profile.isActive) {
      throw new UnauthorizedException('Usuario no autorizado o inactivo');
    }

    return {
      id: profile.id,
      email: payload.email,
      role: profile.role,
      fullName: profile.fullName,
    };
  }
}
