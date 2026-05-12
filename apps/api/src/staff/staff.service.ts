import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Staff } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  findAll(role?: string): Promise<Staff[]> {
    return this.prisma.staff.findMany({
      where: {
        isActive: true,
        ...(role ? { role } : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
