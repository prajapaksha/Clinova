import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Staff } from '@prisma/client';

export type PublicStaff = Omit<Staff, 'passwordHash'>;

// Never return password hashes from listing endpoints.
const PUBLIC_STAFF_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { email } });
  }

  findById(id: string): Promise<Staff | null> {
    return this.prisma.staff.findUnique({ where: { id } });
  }

  findAll(role?: string): Promise<PublicStaff[]> {
    return this.prisma.staff.findMany({
      where: {
        isActive: true,
        ...(role ? { role } : {}),
      },
      select: PUBLIC_STAFF_FIELDS,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
