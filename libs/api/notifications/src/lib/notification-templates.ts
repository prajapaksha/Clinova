import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@clinova/api/shared';
import type { TemplateContent, TemplateView } from '@clinova/notifications/domain';
import {
  DEFAULT_TEMPLATES,
  NOTIFICATION_TYPES,
  NotificationChannel,
  NotificationType,
  renderTemplate,
  sampleValues,
  templateErrors,
} from '@clinova/notifications/domain';

export interface EffectiveTemplate extends TemplateContent {
  readonly isActive: boolean;
}

/** Built-in templates with practice overrides (PRD §4.6: staff configure templates with merge fields). */
@Injectable()
export class NotificationTemplates {
  constructor(private readonly prisma: PrismaService) {}

  async effective(type: NotificationType, channel: NotificationChannel): Promise<EffectiveTemplate | null> {
    const fallback = DEFAULT_TEMPLATES[type]?.[channel];
    if (!fallback) return null;
    const custom = await this.prisma.notificationTemplate.findUnique({ where: { type_channel: { type, channel } } });
    return custom ? { subject: custom.subject, body: custom.body, isActive: custom.isActive } : { ...fallback, isActive: true };
  }

  async list(): Promise<TemplateView[]> {
    const custom = await this.prisma.notificationTemplate.findMany();
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: custom.map(c => c.updatedBy).filter((id): id is string => !!id) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
    const views: TemplateView[] = [];
    for (const type of Object.values(NotificationType)) {
      for (const channel of NOTIFICATION_TYPES[type].channels) {
        const fallback = DEFAULT_TEMPLATES[type][channel];
        if (!fallback) continue;
        const c = custom.find(x => x.type === type && x.channel === channel);
        views.push({
          type, channel,
          subject: c ? c.subject : fallback.subject,
          body: c ? c.body : fallback.body,
          isCustom: !!c,
          isActive: c?.isActive ?? true,
          updatedAt: c?.updatedAt ?? null,
          updatedByName: c?.updatedBy ? names.get(c.updatedBy) ?? null : null,
        });
      }
    }
    return views;
  }

  async save(type: NotificationType, channel: NotificationChannel, input: { subject?: string | null; body: string; isActive: boolean }, userId: string | null): Promise<TemplateView> {
    const spec = NOTIFICATION_TYPES[type];
    if (!spec || !spec.channels.includes(channel) || !DEFAULT_TEMPLATES[type][channel]) {
      throw new BadRequestException('This notification is not sent on that channel.');
    }
    const subject = channel === NotificationChannel.SMS ? null : input.subject?.trim() || null;
    const body = input.body.trim();
    if (!body) throw new BadRequestException('The message cannot be empty.');
    if (channel !== NotificationChannel.SMS && !subject) throw new BadRequestException('Add a subject line.');
    const errors = templateErrors(`${subject ?? ''}\n${body}`, spec.mergeFields);
    if (errors.length) throw new BadRequestException(errors.join(' '));
    await this.prisma.notificationTemplate.upsert({
      where: { type_channel: { type, channel } },
      create: { type, channel, subject, body, isActive: input.isActive, updatedBy: userId },
      update: { subject, body, isActive: input.isActive, updatedBy: userId },
    });
    return (await this.list()).find(v => v.type === type && v.channel === channel) as TemplateView;
  }

  async reset(type: NotificationType, channel: NotificationChannel): Promise<TemplateView | undefined> {
    await this.prisma.notificationTemplate.deleteMany({ where: { type, channel } });
    return (await this.list()).find(v => v.type === type && v.channel === channel);
  }

  /** Renders draft text with example values so staff can see the result before saving. */
  preview(type: NotificationType, input: { subject?: string | null; body: string }) {
    const spec = NOTIFICATION_TYPES[type];
    if (!spec) throw new BadRequestException('Unknown notification type.');
    const values = sampleValues();
    return {
      subject: input.subject ? renderTemplate(input.subject, values) : null,
      body: renderTemplate(input.body, values),
      errors: templateErrors(`${input.subject ?? ''}\n${input.body}`, spec.mergeFields),
    };
  }
}
