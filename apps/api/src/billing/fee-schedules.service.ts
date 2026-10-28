import { Injectable, NotFoundException } from '@nestjs/common';
import type { FeeSchedule as FeeScheduleRow } from '@prisma/client';
import type { FeeSchedule, FeeScheduleId, FeeScheduleLine } from '@clinova/billing/domain';
import { PrismaService } from '../prisma/prisma.service';
import { SaveFeeScheduleDto } from './dto/billing.dto';

export function toFeeSchedule(row: FeeScheduleRow): FeeSchedule {
  return {
    id: row.id as FeeScheduleId,
    name: row.name,
    description: row.description,
    lines: JSON.parse(row.linesJson),
    isDefault: row.isDefault,
    isActive: row.isActive,
    effectiveDate: row.effectiveDate,
  };
}

@Injectable()
export class FeeSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeOnly = true): Promise<FeeSchedule[]> {
    const rows = await this.prisma.feeSchedule.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toFeeSchedule);
  }

  async findById(id: string): Promise<FeeSchedule> {
    const row = await this.prisma.feeSchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Fee schedule ${id} not found`);
    return toFeeSchedule(row);
  }

  /** The requested schedule, or the practice default. */
  async resolve(id?: string | null): Promise<FeeSchedule | null> {
    const row = id
      ? await this.prisma.feeSchedule.findUnique({ where: { id } })
      : await this.prisma.feeSchedule.findFirst({ where: { isDefault: true, isActive: true } });
    return row ? toFeeSchedule(row) : null;
  }

  async create(dto: SaveFeeScheduleDto): Promise<FeeSchedule> {
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) await tx.feeSchedule.updateMany({ data: { isDefault: false } });
      const row = await tx.feeSchedule.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          linesJson: JSON.stringify(normalizeLines(dto.lines)),
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
        },
      });
      return toFeeSchedule(row);
    });
  }

  async update(id: string, dto: SaveFeeScheduleDto): Promise<FeeSchedule> {
    await this.findById(id);
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) await tx.feeSchedule.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      const row = await tx.feeSchedule.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          linesJson: JSON.stringify(normalizeLines(dto.lines)),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      return toFeeSchedule(row);
    });
  }
}

/** Trims codes and keeps the last entry for duplicate codes. */
function normalizeLines(lines: FeeScheduleLine[]): FeeScheduleLine[] {
  const byCode = new Map<string, FeeScheduleLine>();
  for (const l of lines) {
    const code = l.cptCode.trim().toUpperCase();
    byCode.set(code, { cptCode: code, description: l.description.trim(), priceCents: l.priceCents });
  }
  return [...byCode.values()].sort((a, b) => a.cptCode.localeCompare(b.cptCode));
}
