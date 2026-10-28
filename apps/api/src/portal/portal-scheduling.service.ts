import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Appointment, AppointmentType, Staff } from '@prisma/client';
import { isProviderRole } from '@clinova/identity/domain';
import type { AvailabilityDay, BookableType, PortalAppointment, PortalProvider, TimeWindow } from '@clinova/portal/domain';
import { MAX_ADVANCE_BOOKING_DAYS, availableSlots, canChangeOnline, workingWindows } from '@clinova/portal/domain';
import type { DaySchedule } from '@clinova/staff/domain';
import { defaultWeeklySchedule, displayName } from '@clinova/staff/domain';
import { AppointmentStatus, CancellationReason } from '@clinova/scheduling/domain';
import { EncounterStatus } from '@clinova/clinical/domain';
import { PrismaService } from '../prisma/prisma.service';
import { LocalClock } from '../common/local-clock';

const DAY_MS = 86_400_000;
/** Statuses that no longer occupy the provider's time. */
const FREE_STATUSES = [AppointmentStatus.Cancelled, AppointmentStatus.Rescheduled, AppointmentStatus.NoShow];
const CHANGEABLE = [AppointmentStatus.Scheduled, AppointmentStatus.Confirmed];
const SIGNED = [EncounterStatus.Signed, EncounterStatus.Amended];

/** Patient self-scheduling against providers' weekly schedules (PRD §4.2, §4.8). */
@Injectable()
export class PortalSchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async bookableTypes(): Promise<BookableType[]> {
    const rows = await this.prisma.appointmentType.findMany({ where: { isActive: true, isPatientBookable: true }, orderBy: { name: 'asc' } });
    return rows.map(t => ({ id: t.id, name: t.name, description: t.patientDescription, durationMinutes: t.defaultDurationMinutes }));
  }

  async providers(patientId: string): Promise<PortalProvider[]> {
    const [staff, seen] = await Promise.all([
      this.prisma.staff.findMany({ where: { isActive: true }, orderBy: [{ lastName: 'asc' }] }),
      this.prisma.appointment.findMany({ where: { patientId }, select: { providerId: true }, distinct: ['providerId'] }),
    ]);
    const mine = new Set(seen.map(s => s.providerId));
    return staff
      .filter(s => isProviderRole(s.role))
      .map(s => ({
        id: s.id,
        displayName: displayName(s),
        title: s.title,
        specialties: JSON.parse(s.specialtiesJson),
        bio: s.bio,
        officeLocation: s.officeLocation,
        isMyProvider: mine.has(s.id),
      }))
      .sort((a, b) => Number(b.isMyProvider) - Number(a.isMyProvider));
  }

  /** Open slots for `days` local days starting at `from` (YYYY-MM-DD in the patient's time zone). */
  async availability(
    q: { providerId: string; appointmentTypeId: string; from: string; days: number; tzOffset: number; excludeAppointmentId?: string },
    now = new Date(),
  ): Promise<AvailabilityDay[]> {
    const provider = await this.provider(q.providerId);
    const type = await this.bookableType(q.appointmentTypeId);
    const clock = new LocalClock(q.tzOffset);
    const today = clock.dateKey(now);
    const from = q.from < today ? today : q.from;
    const lastDay = clock.dateKey(new Date(now.getTime() + MAX_ADVANCE_BOOKING_DAYS * DAY_MS));
    const schedule = this.schedule(provider);

    const dates: string[] = [];
    for (let i = 0; i < Math.min(Math.max(q.days, 1), 31); i++) {
      const date = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10) + i)).toISOString().slice(0, 10);
      if (date > lastDay) break;
      dates.push(date);
    }
    if (!dates.length) return [];

    const rangeStart = clock.midnight(dates[0]);
    const rangeEnd = new Date(clock.midnight(dates[dates.length - 1]).getTime() + DAY_MS);
    const busy = await this.busy(provider.id, rangeStart, rangeEnd, q.excludeAppointmentId);

    return dates.map(date => {
      const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
      const windows = workingWindows(schedule.find(d => d.dayOfWeek === dayOfWeek), clock.midnight(date));
      return {
        date,
        slots: availableSlots({ windows, busy, durationMinutes: type.defaultDurationMinutes, bufferMinutes: type.bufferAfterMinutes, now }),
      };
    });
  }

  async book(
    patientId: string,
    dto: { providerId: string; appointmentTypeId: string; start: string; reasonForVisit?: string; tzOffset: number },
    now = new Date(),
  ): Promise<PortalAppointment> {
    const slot = await this.assertOpen(dto.providerId, dto.appointmentTypeId, dto.start, dto.tzOffset, now);
    await this.assertPatientFree(patientId, slot);
    const row = await this.prisma.appointment.create({
      data: {
        patientId,
        providerId: dto.providerId,
        appointmentTypeId: dto.appointmentTypeId,
        slotStart: slot.start,
        slotEnd: slot.end,
        status: AppointmentStatus.Scheduled,
        reasonForVisit: dto.reasonForVisit?.trim() || null,
        notes: 'Booked online via the patient portal.',
      },
    });
    return (await this.appointments(patientId, now)).find(a => a.id === row.id) as PortalAppointment;
  }

  async reschedule(patientId: string, appointmentId: string, dto: { start: string; tzOffset: number }, now = new Date()): Promise<PortalAppointment> {
    const existing = await this.changeable(patientId, appointmentId, now);
    const slot = await this.assertOpen(existing.providerId, existing.appointmentTypeId, dto.start, dto.tzOffset, now, existing.id);
    await this.assertPatientFree(patientId, slot, existing.id);
    await this.prisma.appointment.update({
      where: { id: existing.id },
      data: {
        slotStart: slot.start,
        slotEnd: slot.end,
        status: AppointmentStatus.Scheduled,
        notes: [existing.notes, `Rescheduled online by the patient on ${now.toISOString().slice(0, 10)}.`].filter(Boolean).join('\n'),
      },
    });
    return (await this.appointments(patientId, now)).find(a => a.id === existing.id) as PortalAppointment;
  }

  async cancel(patientId: string, appointmentId: string, note: string | undefined, now = new Date()): Promise<PortalAppointment> {
    const existing = await this.changeable(patientId, appointmentId, now);
    await this.prisma.appointment.update({
      where: { id: existing.id },
      data: { status: AppointmentStatus.Cancelled, cancellationReason: CancellationReason.PatientRequest, cancellationNote: note?.trim() || 'Cancelled online by the patient.' },
    });
    return (await this.appointments(patientId, now)).find(a => a.id === existing.id) as PortalAppointment;
  }

  async appointments(patientId: string, now = new Date()): Promise<PortalAppointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { patientId },
      include: { appointmentType: true },
      orderBy: { slotStart: 'desc' },
      take: 200,
    });
    const [staff, encounters] = await Promise.all([
      this.prisma.staff.findMany({ where: { id: { in: [...new Set(rows.map(r => r.providerId))] } } }),
      this.prisma.encounter.findMany({
        where: { appointmentId: { in: rows.map(r => r.id) }, status: { in: SIGNED } },
        select: { id: true, appointmentId: true },
      }),
    ]);
    const providers = new Map(staff.map(s => [s.id, s]));
    const summaries = new Map(encounters.map(e => [e.appointmentId, e.id]));
    return rows.map(r => this.toPortal(r, providers.get(r.providerId), summaries.get(r.id) ?? null, now));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toPortal(row: Appointment & { appointmentType: AppointmentType }, provider: Staff | undefined, visitSummaryId: string | null, now: Date): PortalAppointment {
    return {
      id: row.id,
      start: row.slotStart,
      end: row.slotEnd,
      status: row.status,
      typeId: row.appointmentTypeId,
      typeName: row.appointmentType.name,
      providerId: row.providerId,
      providerName: provider ? displayName(provider) : 'Your provider',
      reasonForVisit: row.reasonForVisit,
      location: provider?.officeLocation ?? null,
      canChange: CHANGEABLE.includes(row.status as AppointmentStatus) && canChangeOnline(row.slotStart, now),
      visitSummaryId,
    };
  }

  private async changeable(patientId: string, appointmentId: string, now: Date): Promise<Appointment> {
    const row = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!row || row.patientId !== patientId) throw new NotFoundException('Appointment not found.');
    if (!CHANGEABLE.includes(row.status as AppointmentStatus)) throw new BadRequestException('This appointment can no longer be changed online.');
    if (!canChangeOnline(row.slotStart, now)) {
      throw new ForbiddenException('Appointments within 24 hours can only be changed by calling the office.');
    }
    return row;
  }

  private async assertOpen(providerId: string, typeId: string, startIso: string, tzOffset: number, now: Date, excludeAppointmentId?: string): Promise<TimeWindow> {
    const start = new Date(startIso);
    const date = new LocalClock(tzOffset).dateKey(start);
    const [day] = await this.availability({ providerId, appointmentTypeId: typeId, from: date, days: 1, tzOffset, excludeAppointmentId }, now);
    const slot = day?.date === date ? day.slots.find(s => s.start.getTime() === start.getTime()) : undefined;
    if (!slot) throw new ConflictException('Sorry, that time is no longer available. Please choose another.');
    return slot;
  }

  private async assertPatientFree(patientId: string, slot: TimeWindow, excludeId?: string): Promise<void> {
    const overlap = await this.prisma.appointment.count({
      where: {
        patientId,
        status: { notIn: FREE_STATUSES },
        slotStart: { lt: slot.end },
        slotEnd: { gt: slot.start },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (overlap) throw new ConflictException('You already have an appointment at that time.');
  }

  private async busy(providerId: string, from: Date, to: Date, excludeId?: string): Promise<TimeWindow[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        providerId,
        status: { notIn: FREE_STATUSES },
        slotStart: { lt: to },
        slotEnd: { gt: from },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { slotStart: true, slotEnd: true },
    });
    return rows.map(r => ({ start: r.slotStart, end: r.slotEnd }));
  }

  private async provider(id: string): Promise<Staff> {
    const s = await this.prisma.staff.findUnique({ where: { id } });
    if (!s || !s.isActive || !isProviderRole(s.role)) throw new NotFoundException('Provider not found.');
    return s;
  }

  private async bookableType(id: string): Promise<AppointmentType> {
    const t = await this.prisma.appointmentType.findUnique({ where: { id } });
    if (!t || !t.isActive || !t.isPatientBookable) throw new BadRequestException('This visit type cannot be booked online.');
    return t;
  }

  private schedule(provider: Staff): DaySchedule[] {
    const schedule = JSON.parse(provider.scheduleJson) as DaySchedule[];
    return schedule.length ? schedule : defaultWeeklySchedule();
  }
}
