import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private supabaseAdmin;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Polyfill WebSocket para Node 20 (no tiene WebSocket nativo)
    if (typeof globalThis.WebSocket === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      globalThis.WebSocket = require('ws');
    }

    this.supabaseAdmin = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  findAll() {
    return this.prisma.profile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Usuario no encontrado');
    return profile;
  }

  /** El teléfono debe ser único entre usuarios (si se proporciona). */
  private async assertPhoneUnique(phone?: string | null, excludeId?: string) {
    const trimmed = phone?.trim();
    if (!trimmed) return;
    const existing = await this.prisma.profile.findFirst({
      where: {
        phone: trimmed,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true, fullName: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un usuario con el teléfono ${trimmed} (${existing.fullName})`,
      );
    }
  }

  async create(dto: CreateUserDto) {
    await this.assertPhoneUnique(dto.phone);

    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: dto.email_confirmed ?? false,
      user_metadata: { full_name: dto.full_name },
    });

    if (error) throw new InternalServerErrorException(error.message);

    try {
      await this.prisma.profile.update({
        where: { id: data.user.id },
        data: {
          fullName: dto.full_name,
          phone: dto.phone ?? null,
          role: dto.role,
          mustChangePassword: dto.must_change_password ?? false,
        },
      });
    } catch (prismaError) {
      // Revertir: eliminar el usuario de Auth para no dejar inconsistencia
      await this.supabaseAdmin.auth.admin.deleteUser(data.user.id);
      // Índice único de teléfono (uq_profiles_phone) → motivo claro
      if ((prismaError as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          `Ya existe un usuario con el teléfono ${dto.phone?.trim() ?? ''}`,
        );
      }
      throw new InternalServerErrorException('Error al configurar el perfil del usuario');
    }

    return this.prisma.profile.findUnique({ where: { id: data.user.id } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    if (dto.phone !== undefined) {
      await this.assertPhoneUnique(dto.phone, id);
    }
    return this.prisma.profile.update({
      where: { id },
      data: {
        ...(dto.full_name !== undefined && { fullName: dto.full_name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.must_change_password !== undefined && { mustChangePassword: dto.must_change_password }),
      },
    });
  }

  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.profile.update({
      where: { id },
      data: { isActive },
    });
  }

  async resetPassword(id: string, password: string) {
    await this.findOne(id);
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (error) throw new InternalServerErrorException(error.message);
    return this.prisma.profile.update({
      where: { id },
      data: { mustChangePassword: true },
    });
  }
}
