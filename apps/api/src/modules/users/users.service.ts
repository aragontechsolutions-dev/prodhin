import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as ws from 'ws';
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
    this.supabaseAdmin = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: ws },
      },
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

  async create(dto: CreateUserDto) {
    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: dto.email_confirmed ?? false,
      user_metadata: { full_name: dto.full_name },
    });

    if (error) throw new InternalServerErrorException(error.message);

    await this.prisma.profile.update({
      where: { id: data.user.id },
      data: {
        fullName: dto.full_name,
        phone: dto.phone ?? null,
        role: dto.role,
        mustChangePassword: dto.must_change_password ?? false,
      },
    });

    return this.prisma.profile.findUnique({ where: { id: data.user.id } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
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
}
