import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  create(dto: CreateCustomerDto, createdById: string) {
    return this.prisma.customer.create({
      data: {
        customerType: dto.customer_type,
        firstName: dto.first_name ?? null,
        lastName: dto.last_name ?? null,
        businessName: dto.business_name ?? null,
        taxId: dto.tax_id ?? null,
        businessType: dto.business_type ?? null,
        contactName: dto.contact_name ?? null,
        phone: dto.phone,
        email: dto.email ?? null,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        notes: dto.notes ?? null,
        createdById,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.customer_type !== undefined && { customerType: dto.customer_type }),
        ...(dto.first_name !== undefined && { firstName: dto.first_name }),
        ...(dto.last_name !== undefined && { lastName: dto.last_name }),
        ...(dto.business_name !== undefined && { businessName: dto.business_name }),
        ...(dto.tax_id !== undefined && { taxId: dto.tax_id }),
        ...(dto.business_type !== undefined && { businessType: dto.business_type }),
        ...(dto.contact_name !== undefined && { contactName: dto.contact_name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.is_active !== undefined && { isActive: dto.is_active }),
      },
    });
  }

  // Clientes asignados a un chofer específico (para app móvil)
  findByDriver(driverId: string) {
    return this.prisma.customer.findMany({
      where: {
        isActive: true,
        driverAssignments: { some: { driverId } },
      },
      orderBy: { businessName: 'asc' },
    });
  }

  // Asignaciones (lista completa con info de chofer y cliente)
  findAllAssignments() {
    return this.prisma.driverCustomer.findMany({
      include: {
        driver: { select: { id: true, fullName: true, role: true } },
        customer: {
          select: {
            id: true,
            customerType: true,
            firstName: true,
            lastName: true,
            businessName: true,
            phone: true,
            address: true,
            lat: true,
            lng: true,
            isActive: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async assign(driverId: string, customerId: string, assignedById: string) {
    // Verificar que existan
    const [driver, customer] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: driverId } }),
      this.prisma.customer.findUnique({ where: { id: customerId } }),
    ]);

    if (!driver) throw new NotFoundException('Chofer no encontrado');
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    try {
      return await this.prisma.driverCustomer.create({
        data: { driverId, customerId, assignedById },
      });
    } catch {
      throw new ConflictException('El cliente ya está asignado a este chofer');
    }
  }

  async unassign(driverId: string, customerId: string) {
    const assignment = await this.prisma.driverCustomer.findUnique({
      where: { driverId_customerId: { driverId, customerId } },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');

    return this.prisma.driverCustomer.delete({
      where: { driverId_customerId: { driverId, customerId } },
    });
  }
}
