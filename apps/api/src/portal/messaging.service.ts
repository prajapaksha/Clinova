import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DomainEventBus } from '../events/domain-event-bus';
import type { MessageThread, Prisma, ThreadMessage as MessageRow } from '@prisma/client';
import type { Thread, ThreadId, ThreadSummary } from '@clinova/portal/domain';
import { ThreadCategory } from '@clinova/portal/domain';
import { AuditAction } from '@clinova/identity/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditContext, AuditService } from '../audit/audit.service';

type Viewer = 'PATIENT' | 'STAFF';
type ThreadWithMessages = MessageThread & { messages: MessageRow[] };
export interface Author {
  id: string;
  name: string;
}

/** Secure patient ↔ care-team messaging (PRD §4.6, §4.8). */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly events?: DomainEventBus,
  ) {}

  private publish(type: 'portal.PatientMessageSent' | 'portal.CareTeamReplied', thread: Thread): void {
    const last = thread.messages[thread.messages.length - 1];
    if (last) this.events?.publish({ type, threadId: thread.id, messageId: last.id, timestamp: new Date() });
  }

  // ── Patient side ───────────────────────────────────────────────────────────

  async patientThreads(patientId: string): Promise<ThreadSummary[]> {
    const rows = await this.prisma.messageThread.findMany({
      where: { patientId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { lastMessageAt: 'desc' },
    });
    return rows.map(r => this.summary(r, 'PATIENT'));
  }

  async patientThread(patientId: string, id: string): Promise<Thread> {
    const row = await this.load(id);
    if (row.patientId !== patientId) throw new NotFoundException('Conversation not found.');
    await this.prisma.messageThread.update({ where: { id }, data: { patientLastReadAt: new Date() } });
    return this.full({ ...row, patientLastReadAt: new Date() }, 'PATIENT');
  }

  async startThread(patientId: string, dto: { subject: string; category: ThreadCategory; body: string }, author: Author): Promise<Thread> {
    const now = new Date();
    const row = await this.prisma.messageThread.create({
      data: {
        patientId,
        subject: dto.subject.trim(),
        category: dto.category,
        lastMessageAt: now,
        patientLastReadAt: now,
        messages: { create: { authorType: 'PATIENT', authorId: author.id, authorName: author.name, body: dto.body.trim(), createdAt: now } },
      },
      include: { messages: true },
    });
    const thread = this.full(row, 'PATIENT');
    this.publish('portal.PatientMessageSent', thread);
    return thread;
  }

  async patientReply(patientId: string, id: string, body: string, author: Author): Promise<Thread> {
    const row = await this.load(id);
    if (row.patientId !== patientId) throw new NotFoundException('Conversation not found.');
    const thread = await this.addMessage(row, 'PATIENT', body, author);
    this.publish('portal.PatientMessageSent', thread);
    return thread;
  }

  async patientUnreadCount(patientId: string): Promise<number> {
    return (await this.patientThreads(patientId)).filter(t => t.unread).length;
  }

  // ── Staff side ─────────────────────────────────────────────────────────────

  async inbox(filters: { status?: string; category?: string; patientId?: string; unreadOnly?: boolean }): Promise<ThreadSummary[]> {
    const where: Prisma.MessageThreadWhereInput = {};
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.patientId) where.patientId = filters.patientId;
    const rows = await this.prisma.messageThread.findMany({
      where,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
    const names = await this.patientNames(rows.map(r => r.patientId));
    const summaries = rows.map(r => ({ ...this.summary(r, 'STAFF'), ...names.get(r.patientId) }));
    return filters.unreadOnly ? summaries.filter(s => s.unread) : summaries;
  }

  async staffThread(id: string, ctx: AuditContext): Promise<Thread> {
    const row = await this.load(id);
    await this.prisma.messageThread.update({ where: { id }, data: { staffLastReadAt: new Date() } });
    await this.audit.log(ctx, { action: AuditAction.View, resourceType: 'MessageThread', resourceId: id, patientId: row.patientId });
    const names = await this.patientNames([row.patientId]);
    return { ...this.full({ ...row, staffLastReadAt: new Date() }, 'STAFF'), ...names.get(row.patientId) };
  }

  async staffReply(id: string, body: string, author: Author, ctx: AuditContext): Promise<Thread> {
    const row = await this.load(id);
    const thread = await this.addMessage(row, 'STAFF', body, author);
    this.publish('portal.CareTeamReplied', thread);
    await this.audit.log(ctx, { action: AuditAction.Create, resourceType: 'ThreadMessage', resourceId: id, patientId: row.patientId });
    const names = await this.patientNames([row.patientId]);
    return { ...thread, ...names.get(row.patientId) };
  }

  async setStatus(id: string, status: 'OPEN' | 'CLOSED'): Promise<ThreadSummary> {
    await this.load(id);
    const row = await this.prisma.messageThread.update({ where: { id }, data: { status }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return this.summary(row, 'STAFF');
  }

  async staffUnreadCount(): Promise<number> {
    return (await this.inbox({ status: 'OPEN', unreadOnly: true })).length;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async addMessage(row: ThreadWithMessages, authorType: Viewer, body: string, author: Author): Promise<Thread> {
    const text = body.trim();
    if (!text) throw new BadRequestException('Write a message first.');
    const now = new Date();
    const updated = await this.prisma.messageThread.update({
      where: { id: row.id },
      data: {
        lastMessageAt: now,
        // A patient writing again reopens the conversation.
        status: authorType === 'PATIENT' ? 'OPEN' : row.status,
        ...(authorType === 'PATIENT' ? { patientLastReadAt: now } : { staffLastReadAt: now }),
        messages: { create: { authorType, authorId: author.id, authorName: author.name, body: text, createdAt: now } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return this.full(updated, authorType);
  }

  private async load(id: string): Promise<ThreadWithMessages> {
    const row = await this.prisma.messageThread.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw new NotFoundException('Conversation not found.');
    return row;
  }

  private summary(row: ThreadWithMessages, viewer: Viewer): ThreadSummary {
    const last = row.messages[row.messages.length - 1];
    const lastRead = viewer === 'PATIENT' ? row.patientLastReadAt : row.staffLastReadAt;
    const fromOtherSide = row.messages.filter(m => m.authorType !== viewer);
    const unread = fromOtherSide.some(m => !lastRead || m.createdAt > lastRead);
    return {
      id: row.id as ThreadId,
      patientId: row.patientId,
      subject: row.subject,
      category: row.category as ThreadCategory,
      status: row.status as 'OPEN' | 'CLOSED',
      lastMessageAt: row.lastMessageAt,
      lastMessagePreview: last ? last.body.slice(0, 140) : '',
      lastAuthorType: (last?.authorType ?? 'PATIENT') as Viewer,
      unread,
      messageCount: row.messages.length,
    };
  }

  private full(row: ThreadWithMessages, viewer: Viewer): Thread {
    return {
      ...this.summary(row, viewer),
      messages: row.messages.map(m => ({ id: m.id, authorType: m.authorType as Viewer, authorName: m.authorName, body: m.body, createdAt: m.createdAt })),
    };
  }

  private async patientNames(ids: string[]): Promise<Map<string, { patientName: string; patientMrn: string }>> {
    const rows = await this.prisma.patient.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, firstName: true, lastName: true, mrn: true } });
    return new Map(rows.map(p => [p.id, { patientName: `${p.firstName} ${p.lastName}`, patientMrn: p.mrn }]));
  }
}
