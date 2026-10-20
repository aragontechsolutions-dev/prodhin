import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AssignCustomerDto } from './dto/assign-customer.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // Admin: lista todos los clientes
  @Roles('admin')
  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  // Chofer: sus clientes asignados (para app móvil)
  @Roles('chofer', 'admin')
  @Get('my')
  findMine(@CurrentUser('id') userId: string) {
    return this.customersService.findByDriver(userId);
  }

  @Roles('admin')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Roles('admin')
  @Post()
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.customersService.create(dto, userId);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  // Asignaciones
  @Roles('admin')
  @Get('assignments/all')
  findAllAssignments() {
    return this.customersService.findAllAssignments();
  }

  @Roles('admin')
  @Post('assignments')
  assign(
    @Body() dto: AssignCustomerDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.customersService.assign(dto.driver_id, dto.customer_id, adminId);
  }

  @Roles('admin')
  @Delete('assignments/:driverId/:customerId')
  unassign(
    @Param('driverId') driverId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.unassign(driverId, customerId);
  }
}
