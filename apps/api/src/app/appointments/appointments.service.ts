import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Appointment, AppointmentType, Staff } from '@prisma/client';
import { BookAppointmentDto, UpdateAppointmentDto } from './dto/book-appointment.dto';

export interface EnrichedAppointment extends Appointment {
  patientName?: string;
  patientMrn?: string;
  typeName?: string;
  typeColor?: string;
  providerName?: string;
  appointmentType?: AppointmentType;
}

export interface FindManyFilters {
  from?: string;
  to?: string;
  providerId?: string;
  patientId?: string;
  status?: string | string[];
  limit?: number;
  offset?: number;
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toAppointment(
    row: Appointment & { appointmentType?: AppointmentType },
    patient?: { id: string; firstName: string; lastName: string; mrn: string } | null,
    type?: AppointmentType | null,
    provider?: Staff | null,
  ): EnrichedAppointment {
    const resolvedType = type ?? row.appointmentType ?? null;
    return {
      ...row,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
      patientMrn: patient?.mrn,
      typeName: resolvedType?.name,
      typeColor: resolvedType?.color,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : undefined,
      appointmentType: resolvedType ?? undefined,
    };
  }

  async findMany(filters: FindManyFilters): Promise<{ appointments: EnrichedAppointment[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.from || filters.to) {
      where['slotStart'] = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    if (filters.providerId) {
      where['providerId'] = filters.providerId;
    }

    if (filters.patientId) {
      where['patientId'] = filters.patientId;
    }

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      where['status'] = { in: statuses };
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const [rows, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: { appointmentType: true },
        orderBy: { slotStart: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    // Batch-fetch patients and staff for enrichment
    const patientIds = [...new Set(rows.map((r) => r.patientId))];
    const providerIds = [...new Set(rows.map((r) => r.providerId))];

    const [patients, providers] = await Promise.all([
      patientIds.length > 0
        ? this.prisma.patient.findMany({
            where: { id: { in: patientIds } },
            select: { id: true, firstName: true, lastName: true, mrn: true },
          })
        : [],
      providerIds.length > 0
        ? this.prisma.staff.findMany({
            where: { id: { in: providerIds } },
          })
        : [],
    ]);

    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const providerMap = new Map((providers as Staff[]).map((s) => [s.id, s]));

    const appointments = rows.map((row) =>
      this.toAppointment(
        row,
        patientMap.get(row.patientId) ?? null,
        null,
        providerMap.get(row.providerId) ?? null,
      ),
    );

    return { appointments, total };
  }

  async findById(id: string): Promise<EnrichedAppointment> {
    const row = await this.prisma.appointment.findUnique({
      where: { id },
      include: { appointmentType: true },
    });

    if (!row) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    const [patient, provider] = await Promise.all([
      this.prisma.patient.findUnique({
        where: { id: row.patientId },
        select: { id: true, firstName: true, lastName: true, mrn: true },
      }),
      this.prisma.staff.findUnique({ where: { id: row.providerId } }),
    ]);

    return this.toAppointment(row, patient, null, provider);
  }

  async create(dto: BookAppointmentDto): Promise<EnrichedAppointment> {
    const slotStart = new Date(dto.slotStart);
    const slotEnd = new Date(dto.slotEnd);

    const conflicts = await this.findConflicts(dto.providerId, slotStart, slotEnd);
    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Provider has a conflicting appointment at this time (id: ${conflicts[0].id})`,
      );
    }

    const row = await this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        providerId: dto.providerId,
        locationId: dto.locationId ?? 'main',
        appointmentTypeId: dto.appointmentTypeId,
        slotStart,
        slotEnd,
        status: 'SCHEDULED',
        reasonForVisit: dto.reasonForVisit ?? null,
        notes: dto.notes ?? null,
      },
      include: { appointmentType: true },
    });

    return this.findById(row.id);
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<EnrichedAppointment> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.slotStart !== undefined ? { slotStart: new Date(dto.slotStart) } : {}),
        ...(dto.slotEnd !== undefined ? { slotEnd: new Date(dto.slotEnd) } : {}),
        ...(dto.reasonForVisit !== undefined ? { reasonForVisit: dto.reasonForVisit } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.cancellationReason !== undefined ? { cancellationReason: dto.cancellationReason } : {}),
        ...(dto.cancellationNote !== undefined ? { cancellationNote: dto.cancellationNote } : {}),
      },
    });

    return this.findById(id);
  }

  async checkIn(id: string): Promise<EnrichedAppointment> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CHECKED_IN', checkedInAt: new Date() },
    });

    return this.findById(id);
  }

  async cancel(id: string, reason: string, note?: string): Promise<EnrichedAppointment> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancellationNote: note ?? null,
      },
    });

    return this.findById(id);
  }

  async noShow(id: string): Promise<EnrichedAppointment> {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    await this.prisma.appointment.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });

    return this.findById(id);
  }

  async findConflicts(
    providerId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<Appointment[]> {
    return this.prisma.appointment.findMany({
      where: {
        providerId,
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
        slotStart: { lt: end },
        slotEnd: { gt: start },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findAllTypes(activeOnly = true): Promise<AppointmentType[]> {
    return this.prisma.appointmentType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }
}
