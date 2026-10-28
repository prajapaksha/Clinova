# Clinova — Development Log (Phases 0–6)

> A reconstructed record of the AI-assisted development sessions that resumed Clinova in
> October 2026. It is assembled from session checkpoints, git history and the code itself —
> **not** a verbatim chat transcript (earlier parts of the conversation were condensed and no
> raw transcript was retained). Requests are paraphrased; commands, configuration and code
> excerpts are copied from the repository.

|              |                                                                                    |
| ------------ | ---------------------------------------------------------------------------------- |
| Repository   | `prajapaksha/Clinova` (branch `main`)                                              |
| Requirements | [Clinova_Requirements.md](./Clinova_Requirements.md) (PRD)                         |
| UI designs   | Google Stitch project `479370941870535258` (11 screens)                            |
| Stack        | Nx monorepo · Angular 21 + Angular Material · NestJS 11 · Prisma 7 + SQLite · pnpm |
| Status       | Phases 0–6 committed; next is Phase 7 (Reports)                                    |

---

## Contents

1. [Session timeline](#1-session-timeline)
2. [Where development had stopped](#2-where-development-had-stopped)
3. [Phase plan](#3-phase-plan)
4. [Workspace layout](#4-workspace-layout)
5. [Day-to-day commands](#5-day-to-day-commands)
6. [Phase 0 — Stabilize](#6-phase-0--stabilize)
7. [Phase 1 — Clinical encounters](#7-phase-1--clinical-encounters)
8. [Phase 2 — Role-aware dashboard](#8-phase-2--role-aware-dashboard)
9. [Phase 3 — Billing](#9-phase-3--billing)
10. [Phase 4 — Staff, RBAC and audit](#10-phase-4--staff-rbac-and-audit)
11. [Phase 5 — Patient portal](#11-phase-5--patient-portal)
12. [Phase 6 — Notifications and worker](#12-phase-6--notifications-and-worker)
13. [Database migrations](#13-database-migrations)
14. [API endpoint reference](#14-api-endpoint-reference)
15. [Environment variables](#15-environment-variables)
16. [Seed data and demo accounts](#16-seed-data-and-demo-accounts)
17. [Testing and verification](#17-testing-and-verification)
18. [Troubleshooting and gotchas](#18-troubleshooting-and-gotchas)
19. [Deferred items and next steps](#19-deferred-items-and-next-steps)

---

## 1. Session timeline

| #   | Request (paraphrased)                                                       | Outcome                                                                                                              |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Can you access previous chats for this project?                             | No earlier chat history was stored for this workspace; work resumed from the repo state.                             |
| 2   | Find where I stopped and plan how to resume, based on the requirements doc. | Found an uncommitted refactor (features moving into DDD libs); reviewed PRD and Stitch designs; proposed Phases 0–8. |
| 3   | UI designs are in Stitch (`stitch.google.com/projects/479370941870535258`). | Reviewed 11 screens; used them for encounters, dashboard, billing and portal UIs.                                    |
| 4   | Start Phase 0.                                                              | Stabilization — commit `c0dfbd5`.                                                                                    |
| 5   | Push committed changes before Phase 1.                                      | Pushed to `origin/main`.                                                                                             |
| 6   | How do I test Phase 1?                                                      | Testing walkthrough (see [§7](#7-phase-1--clinical-encounters)).                                                     |
| 7   | Start Phase 2.                                                              | Dashboard — commit `66266c7` (Phase 1 was `6b08b48`).                                                                |
| 8   | Pushed; start Phase 3.                                                      | Billing — commit `3303865`.                                                                                          |
| 9   | How do I kill the API server if it's already running and restart?           | Port-kill commands (see [§5](#5-day-to-day-commands)).                                                               |
| 10  | Pushed; start Phase 4.                                                      | Staff/RBAC/audit — commit `57da0bd`.                                                                                 |
| 11  | Implement Phase 5.                                                          | Patient portal — commit `3f5b463`. Decision: portal accounts via invite code **or** self-registration.               |
| 12  | Implement Phase 6.                                                          | Notifications/worker — commit `e99d7a0`. Decision: database outbox + polling worker now, BullMQ later.               |
| 13  | Copy this chat to a formatted document.                                     | This file.                                                                                                           |

---

## 2. Where development had stopped

Git history before resuming (May 2026):

```text
094e225 2026-05-12 feat(scheduling): add full calendar, booking, and patient appointments
7db90e4 2026-05-11 chore(staff-web): set dev server port to 4400 in serve target
61bdb7a 2026-05-11 chore: change dev server port from 4200 to 4400
1209d7a 2026-05-11 feat(patients): complete patient profile actions and document upload
ba1ecff 2026-05-11 fix(patients): align card content left margin with card title
c387beb 2026-05-11 feat: add JWT authentication — NestJS + Angular
5ab6c3d 2026-05-11 feat: build patients feature — Angular UI, NestJS API, Prisma/SQLite
5159f3c 2026-05-11 feat: scaffold full Clinova PMS monorepo
```

Implemented at that point: patients (list/new/profile/documents), JWT auth, scheduling calendar.
Uncommitted work in progress: moving `apps/staff-web/src/app/features/*` into
`libs/<domain>/feature-*` libraries. Scheduling tables had been created with `prisma db push`
(no migration), and several `feature-*` libs were still generator placeholders.

---

## 3. Phase plan

| Phase | Scope                                                                       | PRD              | Commit    |
| ----- | --------------------------------------------------------------------------- | ---------------- | --------- |
| 0     | Stabilize: finish DDD refactor, lint/test/build green, session bug          | —                | `c0dfbd5` |
| 1     | Clinical encounters: SOAP notes, vitals, ICD-10, prescriptions, signing     | §4.4             | `6b08b48` |
| 2     | Role-aware staff dashboard (KPIs, roster, alerts)                           | §6.1             | `66266c7` |
| 3     | Billing: invoices, payments, claims, fee schedules                          | §4.5             | `3303865` |
| 4     | Staff management, permission matrix (RBAC), audit trail, password policy    | §3.2, §4.3, §5.1 | `57da0bd` |
| 5     | Patient portal (separate Angular app)                                       | §4.8             | `3f5b463` |
| 6     | Notifications (email/SMS/portal), background worker, templates              | §4.6             | `e99d7a0` |
| 7     | Reports & analytics                                                         | §4.7             | _next_    |
| 8     | Hardening: PostgreSQL, Redis/BullMQ, MFA, refresh tokens, S3, real payments | §5               | planned   |

Per-phase working pattern:

1. Plan todos → domain rules (framework-free libs) → Prisma schema + migration → API → UI.
2. Unit tests for domain libs; integration tests for API services on a temporary SQLite DB.
3. Headless Playwright browser walkthrough on separate ports (3001/4301/4401) so the
   developer's own servers on 3000/4300/4400 keep running.
4. Reseed, run the full `lint test build`, commit locally; the developer pushes.

---

## 4. Workspace layout

```text
apps/
  api/              NestJS REST API (port 3000, prefix /api)
  worker/           NestJS application context — notification outbox worker (Phase 6)
  staff-web/        Angular staff app (port 4400)
  patient-portal/   Angular patient portal (port 4300)
  *-e2e/            Playwright / Jest e2e scaffolds
libs/
  api/              notifications, shared            (server-side Nest libs)
  billing/          data-access, domain, feature-billing
  clinical/         data-access, domain, feature-encounters
  identity/         data-access, domain, feature-auth
  notifications/    data-access, domain, feature-messages
  patient/          data-access, domain, feature-patient-list, feature-patient-new, feature-patient-profile
  portal/           data-access, domain, feature-portal
  reporting/        data-access, domain, feature-dashboard, feature-reports
  scheduling/       data-access, domain, feature-calendar
  shared/           auth, feature-settings, ui, util
  staff/            data-access, domain, feature-staff
prisma/             schema.prisma, migrations/, seed.ts
docs/               PRD, this log, credentials.txt (git-ignored)
storage/            uploaded documents + dev outbox (git-ignored)
```

Conventions:

- `*/domain` libs are framework-free TypeScript (types, rules, permission matrix) shared by
  API, worker and both Angular apps.
- `*/data-access` libs hold Angular API services; `feature-*` libs hold lazy-loaded pages.
- Import aliases: `@clinova/<domain>/<lib>` (e.g. `@clinova/identity/domain`,
  `@clinova/api/notifications`).

---

## 5. Day-to-day commands

### Install and database

```powershell
pnpm install
pnpm exec prisma migrate dev          # apply migrations to dev.db (+ generate client)
pnpm exec prisma generate             # regenerate client only
pnpm exec prisma db seed              # wipe + reseed demo data
pnpm exec prisma migrate reset --force   # drop DB, re-apply all migrations, seed
pnpm exec prisma studio               # browse data
```

### Run the apps

```powershell
pnpm nx serve api                     # http://localhost:3000/api   (Swagger UI at /api/docs)
pnpm nx serve staff-web               # http://localhost:4400
pnpm nx serve patient-portal          # http://localhost:4300
pnpm nx serve worker                  # notification worker (Phase 6+)
```

Run a second copy on other ports (used for verification without touching your servers):

```powershell
$env:PORT='3001'; pnpm nx serve api
pnpm nx serve staff-web --port 4401 --proxy-config "<path>\proxy-3001.json"
pnpm nx serve patient-portal --port 4301 --proxy-config "<path>\proxy-3001.json"
```

`proxy-3001.json`:

```json
{
  "/api": {
    "target": "http://localhost:3001",
    "secure": false,
    "changeOrigin": true
  }
}
```

### Kill a server that is already running and restart (answer to request #9)

Preferred: press `Ctrl+C` in the terminal running `nx serve`. If the port is still held
(e.g. the terminal was closed):

```powershell
# Find what is listening on port 3000
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalPort, OwningProcess

# Stop that process (by id) and restart
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
pnpm nx serve api
```

Restart the API after every phase — new Prisma models and modules are only picked up on start.

### Lint, test, build

```powershell
# Everything (the e2e scaffolds are excluded)
pnpm nx run-many -t lint test build --exclude="*-e2e" --outputStyle=static

# Selected projects — quote comma lists in PowerShell
pnpm nx run-many -t test "--projects=api,notifications-domain"

pnpm nx test api
pnpm nx lint staff-web
pnpm nx reset                          # clear the Nx daemon/cache after moving or adding libs
```

### Git

```powershell
git status --short
git --no-pager log --oneline -10
git push origin main
```

---

## 6. Phase 0 — Stabilize

**Commit:** `c0dfbd5 refactor(staff-web): move features into DDD feature libraries`

- Finished moving all staff-web feature pages into `libs/<domain>/feature-*`, lazy-loaded via
  `@clinova/*` aliases; `AuthService` moved to `libs/shared/auth`.
- Removed generator placeholder components and `nx-welcome` scaffolds.
- **Session lost on page reload** — `AuthService` called `/api/auth/me` in its constructor, while
  the HTTP interceptor injects `AuthService` → circular DI. Fixed by restoring the session from an
  app initializer:

```ts
// apps/staff-web/src/app/app.config.ts
provideAppInitializer(() => inject(AuthService).restoreSession()),
```

```ts
// libs/shared/auth/src/lib/auth/auth.ts
// Call from an app initializer, not the constructor: the HTTP interceptor injects
// AuthService, so a request during construction hits a circular-DI error.
restoreSession(): Observable<StaffUser | null> {
  if (!this.getToken()) return of(null);
  return this.http.get<StaffUser>('/api/auth/me').pipe(
    tap(user => this._user.set(user)),
    map(user => user as StaffUser | null),
    catchError(() => {
      this.clearSession();
      return of(null);
    }),
  );
}
```

- Lint fixes: `clv-` root selector prefix, strict equality in templates, keyboard accessibility for
  calendar day columns and appointment blocks.
- Empty domain specs → `passWithNoTests`; added `AuthService` specs; updated app specs and
  Playwright smoke tests.
- `libs/shared/util` build fixed (`moduleResolution` for CommonJS).
- `docs/credentials.txt` added to `.gitignore`; Playwright Chromium installed
  (`pnpm exec playwright install chromium`).

---

## 7. Phase 1 — Clinical encounters

**Commit:** `6b08b48 feat(clinical): encounters with SOAP notes, prescriptions, and signing` · PRD §4.4

**Data:** `Encounter`, `Prescription`, `EncounterTemplate` (migration `20261027183014_add_encounters`)
plus a baseline migration `20260512120000_add_scheduling` for tables previously created with
`db push` (marked as applied).

**API (`apps/api/src/encounters`)**

- Begin an encounter from a checked-in appointment (appointment → _In Progress_) or as a walk-in.
- Autosave updates; **sign** locks the note and completes the appointment; addenda on signed notes;
  discard unsigned drafts.
- Prescriptions screened for allergy (incl. drug-class cross-sensitivity), interactions and
  duplicate therapy; alerts must be acknowledged before issuing.
- ICD-10-CM search ranked by match and usage; drug catalog search.
- Role checks: notes restricted to clinicians/admins; only physicians sign, amend and prescribe.
- Security fix: `GET /api/staff` no longer returned password hashes.

**UI (`libs/clinical/feature-encounters`)** — editor per Stitch design: patient context panel,
SOAP sections, vitals with BMI, templates, ICD-10 chips, lab orders, Rx composer dialog, autosave
status, Sign / Save draft / Discard; encounter start page (appointment, walk-in, quick create);
encounters list with status filters; patient **Notes** tab timeline; _Begin/Open encounter_ actions
on the calendar and patient appointments.

**How to test Phase 1 (answer to request #6)**

1. `pnpm exec prisma migrate dev` then `pnpm exec prisma db seed`; restart the API.
2. Sign in as `reception@clinova.health`, open **Calendar**, check in Ruth Abernathy (today).
3. Sign in as `dr.chen@clinova.health`, open the appointment → **Begin encounter**.
4. Fill SOAP + vitals, add an ICD-10 code (e.g. search "hypertension").
5. Prescribe a drug that conflicts with Ruth's allergies (e.g. Codeine) → alert must be acknowledged.
6. **Sign** the note → it locks, the appointment completes, and an addendum can be added.
7. Check the patient's **Notes** tab and the **Encounters** list.
8. Sign in as `nurse.kim@` — notes are visible but signing/prescribing is not allowed.

---

## 8. Phase 2 — Role-aware dashboard

**Commit:** `66266c7 feat(reporting): role-aware staff dashboard with live KPIs and alerts` · PRD §6.1

- Moved `libs/shared/feature-dashboard` → `libs/reporting/feature-dashboard`:

```powershell
pnpm nx g @nx/workspace:move --projectName=feature-dashboard --destination=libs/reporting/feature-dashboard --no-interactive
pnpm nx reset
```

- `GET /api/dashboard?date&tzOffset&providerId` computes the client's local day: appointments today
  vs the same weekday last week, check-ins, waiting, no-shows, unsigned notes (clinical roles only),
  30-day no-show rate vs the 8% PRD target.
- Today's roster with critical-alert flags and actions (check in, begin/open encounter, open chart,
  mark no-show).
- Derived alerts: critical allergies on today's schedule, patients waiting 20+ min, notes unsigned
  24+ h, no-shows (Phase 4 added credential-expiry alerts).
- 7-day volume chart and busiest two-hour window; physicians default to _My schedule_;
  auto-refresh every minute; **Export PDF** via print styles.

---

## 9. Phase 3 — Billing

**Commit:** `3303865 feat(billing): invoices, payments, claims, fee schedules, and billing dashboard` · PRD §4.5

**Data:** `FeeSchedule`, `Invoice`, `Payment`, `PaymentAllocation`, `InsuranceClaim`, `Counter`;
`AppointmentType.defaultServiceCode` (migration `20261028113148_add_billing`).

**Domain event bus** — signing an encounter publishes `clinical.EncounterSigned`; billing drafts an
invoice (idempotent) priced from the default fee schedule. (Moved to `libs/api/shared` in Phase 6.)

```ts
// libs/api/shared/src/lib/domain-event-bus.ts
@Injectable()
export class DomainEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly events$ = new Subject<DomainEvent>();
  private readonly subscriptions = new Subscription();

  publish<T extends DomainEvent>(event: T): void {
    this.events$.next(event);
  }

  on<T extends DomainEvent>(
    type: T['type'],
    handler: (event: T) => Promise<unknown> | unknown,
  ): void {
    this.subscriptions.add(
      this.events$
        .pipe(
          filter((e): e is T => e.type === type),
          mergeMap((event) =>
            from(Promise.resolve().then(() => handler(event))).pipe(
              catchError((err) => {
                this.logger.error(
                  `Handler for ${type} failed: ${err instanceof Error ? err.message : err}`,
                );
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe(),
    );
  }

  onModuleDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
```

**Rules implemented**

- Invoice lifecycle: draft → issue (30-day due date) → derived status (sent / partially paid / paid /
  overdue / voided). Paid invoices are locked; voids need a reason and no payments.
- Payments allocated oldest-first (or to chosen invoices); overpayment kept as patient credit;
  payment voids by admin/billing only.
- Adjustments (write-off, discount, contractual) capped at the balance.
- Claims pipeline with enforced transitions; _mark paid_ records the insurer payment and contractual
  write-down in one transaction.
- Fee schedules (admin edits), patient statements, billing summary (AR, aging buckets, collections,
  6-month revenue, payer mix).

**UI (`libs/billing/feature-billing`)** — billing dashboard (Stitch), invoice list/detail (draft
editing, history, print), new invoice, take-payment dialog with allocation preview, claims tracker,
fee schedule editor, printable statement; patient **Billing** tab.

**Integration tests** run against a temporary SQLite database built from every `migration.sql`
(`apps/api/src/testing/test-database.ts`).

---

## 10. Phase 4 — Staff, RBAC and audit

**Commit:** `57da0bd feat: Phase 4 - staff management, RBAC and audit logging` · PRD §3.2, §4.3, §5.1

### Permission matrix (single source of truth)

`libs/identity/domain/src/lib/identity-domain.ts` defines roles (`SUPER_ADMIN`, `ADMIN`,
`PHYSICIAN`, `NURSE`, `STAFF`, `BILLING`, `PATIENT`), capabilities (e.g. `patient:profiles`,
`clinical:notes`, `billing:invoices`, `system:settings`, `identity:auditLogs`), the matrix from
PRD §3.2, and helpers `hasAccess(role, capability, 'read' | 'write' | 'full')`, `satisfiesAny`,
`canManageAccount` (practice admins cannot manage super admins).

API decorator and global guard:

```ts
// apps/api/src/auth/decorators/permit.decorator.ts
export const PERMIT_KEY = 'permit';
export const Permit = (...rules: PermissionRule[]) =>
  SetMetadata(PERMIT_KEY, rules);

/** Any access (full, limited, or read-only). */
export const read = (capability: CapabilityKey): PermissionRule => ({
  capability,
  access: 'read',
});
/** Full or limited access. */
export const write = (capability: CapabilityKey): PermissionRule => ({
  capability,
  access: 'write',
});
/** Full access only. */
export const full = (capability: CapabilityKey): PermissionRule => ({
  capability,
  access: 'full',
});
```

```ts
// apps/api/src/auth/guards/permissions.guard.ts (registered as APP_GUARD after JwtAuthGuard)
canActivate(context: ExecutionContext): boolean {
  const targets = [context.getHandler(), context.getClass()];
  if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

  const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  if (this.reflector.getAllAndOverride<boolean>(PATIENT_ROUTE_KEY, targets)) {
    if (user?.role === UserRole.Patient && user.patientId) return true;
    throw new ForbiddenException('This area is for patients.');
  }
  const rules = this.reflector.getAllAndOverride<PermissionRule[] | undefined>(PERMIT_KEY, targets);

  const allowed = rules?.length
    ? satisfiesAny(user?.role, rules)
    : STAFF_ROLES.includes(user?.role as UserRole);
  if (allowed) return true;
  throw new ForbiddenException('You do not have permission to perform this action.');
}
```

Usage example:

```ts
@Get('notifications')
@Permit(read('patient:profiles'))
@Audited({ action: AuditAction.View, resourceType: 'NotificationLog',
  resourceId: req => (req.query['patientId'] as string) ?? null,
  patientId: req => (req.query['patientId'] as string) ?? null })
log(/* … */) { /* … */ }
```

The staff app uses the same matrix: a `Permissions` service, `requirePermission` route guards and
capability-filtered navigation.

### Security (PRD §5.1)

| Rule                 | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Account lockout      | 5 failed sign-ins → locked 15 minutes                        |
| Password policy      | 12+ chars, upper, lower, digit, symbol                       |
| Password rotation    | 90 days; temporary passwords force a change                  |
| Idle timeout (staff) | 15 minutes, with warning                                     |
| Medical fields       | Limited roles get 403 when changing `PATIENT_MEDICAL_FIELDS` |

### Audit trail

- `AuditLog` model; `@Audited(spec)` interceptor for PHI reads; `AuditService.logFieldChanges` for
  field-level patient/staff edits; sign-in / failed sign-in / lockout events.
- Settings → **Audit log** viewer (filters, CSV export, patient access log) and read-only
  **Roles & permissions** matrix.

### Staff management (PRD §4.3)

- Profiles (title, suffix, NPI, specialties, bio, office), weekly schedules with lunch breaks,
  credentials with expiry tracking (90/30/7 days), verification by managers only.
- Directory, profile tabs (overview, credentials, schedule, security), add staff with one-time
  temporary password, password reset, unlock, role change, deactivate; dashboard credential alerts.

Migration: `20261028141502_staff_profiles_and_audit`.

---

## 11. Phase 5 — Patient portal

**Commit:** `3f5b463 feat: Phase 5 - patient portal` · PRD §4.8

**Decision (asked):** portal accounts are created **either** with a staff-issued invite code **or**
by self-registration that matches last name + date of birth + email on file.

**Portal app (`apps/patient-portal`, `libs/portal/feature-portal`)**

- Sign in, create account (invite or self-register), forgot/reset password, 30-minute idle sign-out,
  lockout.
- Home: next appointment, balance due, unread messages, new results/documents.
- Self-scheduling from provider weekly schedules (visit type → provider → date/time → confirm);
  reschedule/cancel online outside a 24-hour cutoff.
- Health records: printable visit summaries, released results with the doctor's note, documents,
  medications (refill requests), allergies, conditions, immunizations.
- Billing: open bills, payment history, saved cards, **Pay now** through a simulated, tokenized
  card gateway (card numbers never stored).
- Secure messaging (non-urgent disclaimer); profile/contact/insurance changes submitted for staff
  review; notification preferences. Responsive layout with a bottom tab bar on phones.

**Staff side** — portal access card on the patient profile (invite code, disable/enable); documents
stored on disk and downloadable; share with patient; physician-only release of lab/imaging results
with a note; **Messages** inbox (conversations, refill approvals, profile update review applied with
field-level audit) and nav unread badge.

**API** — patient JWTs carry `typ: 'patient'`; patient endpoints use `@PatientRoute()` and are
isolated from staff routes. Local file storage under `FILE_STORAGE_DIR`.

Data: `PatientAccount`, `MessageThread`, `ThreadMessage`, `RefillRequest`, `ProfileChangeRequest`,
`SavedPaymentMethod` (migration `20261028152822_patient_portal`).

---

## 12. Phase 6 — Notifications and worker

**Commit:** `e99d7a0 feat(notifications): Phase 6 - notification outbox, worker and templates` · PRD §4.6

**Decision (asked):** use a **database outbox polled by the worker** now (no Redis); swap to BullMQ
in Phase 8.

### Architecture

```text
 API request ──► domain service ──► DomainEventBus.publish(event)
                                         │
                                         ▼
                        NotificationEventHandlers (libs/api/notifications)
                          │                          │
                          ▼                          ▼
          Notification rows (outbox)       StaffNotification rows (bell)
          EMAIL / SMS = QUEUED
          PORTAL      = SENT immediately
                          │
                          ▼
     apps/worker  ── NotificationDispatcher ──► DevOutbox | SendGrid | Twilio
                  ── NotificationScheduler  (reminder backfill, statement reminders)
```

New libraries (generated with `@nx/nest:library`, no unit-test runner):

```powershell
pnpm nx g @nx/nest:library --directory=libs/api/shared --importPath=@clinova/api/shared --unitTestRunner=none --no-interactive
pnpm nx g @nx/nest:library --directory=libs/api/notifications --importPath=@clinova/api/notifications --unitTestRunner=none --no-interactive
pnpm nx reset
```

- `@clinova/api/shared` — `PrismaService`, `PrismaModule`, `DomainEventBus`, `EventsModule`
  (API files re-export them so existing imports still work).
- `@clinova/api/notifications` — practice settings, event contracts, delivery providers, templates,
  outbox, appointment notices, billing snapshot, dispatcher, scheduler, queries, event handlers.

### Notification types and rules (`libs/notifications/domain`)

```ts
export enum NotificationType {
  AppointmentConfirmation = 'APPOINTMENT_CONFIRMATION',
  AppointmentReminder48h = 'APPOINTMENT_REMINDER_48H',
  AppointmentReminder2h = 'APPOINTMENT_REMINDER_2H',
  AppointmentRescheduled = 'APPOINTMENT_RESCHEDULED',
  AppointmentCancelled = 'APPOINTMENT_CANCELLED',
  NoShowFollowUp = 'NO_SHOW_FOLLOW_UP',
  InvoiceIssued = 'INVOICE_ISSUED',
  PaymentReceipt = 'PAYMENT_RECEIPT',
  StatementReminder30d = 'STATEMENT_REMINDER_30D',
  StatementReminder60d = 'STATEMENT_REMINDER_60D',
  DocumentAvailable = 'DOCUMENT_AVAILABLE',
  ResultsReady = 'RESULTS_READY',
  RefillApproved = 'REFILL_APPROVED',
  RefillDenied = 'REFILL_DENIED',
  MessageReceived = 'MESSAGE_RECEIVED',
  ProfileUpdateReviewed = 'PROFILE_UPDATE_REVIEWED',
}

export enum NotificationChannel {
  Email = 'EMAIL',
  SMS = 'SMS',
  Portal = 'PORTAL',
}

export enum NotificationStatus {
  Queued = 'QUEUED',
  Sending = 'SENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
  Suppressed = 'SUPPRESSED',
  Cancelled = 'CANCELLED',
}
```

Template rendering and delivery rules:

```ts
const FIELD = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Replaces {{merge_fields}}; unknown or missing values render as empty text. */
export function renderTemplate(
  text: string,
  values: Partial<Record<MergeField, string | null | undefined>>,
): string {
  return text
    .replace(FIELD, (_, name: string) => values[name as MergeField] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Standard SMS segments (GSM-7: 160 chars, 153 per segment when split). */
export function smsSegments(text: string): number {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

export const REMINDERS = [
  { type: NotificationType.AppointmentReminder48h, hoursBefore: 48 },
  { type: NotificationType.AppointmentReminder2h, hoursBefore: 2 },
];

export const MAX_DELIVERY_ATTEMPTS = 5;

/** Exponential backoff between delivery attempts: 1, 2, 4, 8 … minutes, capped at 1 hour. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 60) * 60_000;
}
```

| Rule                | Behaviour                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preferences         | Patient topic preferences (appointments, bookings, billing, documents, results, prescriptions, messages) per channel; opted-out → `SUPPRESSED` with reason |
| Missing contact     | No email / phone on file → `SUPPRESSED` with reason                                                                                                        |
| Privacy             | Email/SMS never contain clinical detail; they point to the portal                                                                                          |
| Dedupe              | `dedupeKey` is unique (`<type>:<appointmentId>:<slotStartISO>:<channel>` etc.)                                                                             |
| Reminders           | 48 h and 2 h before the visit; created at booking and backfilled by the worker (49 h horizon); 48 h skipped if booked < 48 h ahead                         |
| Reschedule / cancel | Pending reminders for the old time are `CANCELLED`; dispatcher re-validates the appointment before sending                                                 |
| SMS quiet hours     | 8 am – 9 pm practice time zone; outside that, deferred to the next window                                                                                  |
| Retries             | Exponential backoff, max 5 attempts → `FAILED`; staff can _Send again_                                                                                     |
| Statement reminders | One consolidated message per patient at 30 and 60 days overdue, keyed to the oldest overdue bill                                                           |
| Portal notices      | Written as `SENT` immediately (only if the portal account is active)                                                                                       |

Staff in-app alert audiences: billing messages → billing roles; prescription/results messages →
providers + nurses; general/appointment messages → front desk + nurses; refill requests → the
prescriber; profile updates → front desk + admin.

### Data model

```prisma
model Notification {
  id                String    @id @default(cuid())
  type              String              // NotificationType
  channel           String              // EMAIL | SMS | PORTAL
  patientId         String?
  appointmentId     String?
  relatedType       String?
  relatedId         String?
  recipient         String?
  subject           String?
  body              String
  status            String    @default("QUEUED")
  statusReason      String?
  scheduledFor      DateTime  @default(now())
  attempts          Int       @default(0)
  lastError         String?
  provider          String?
  providerMessageId String?
  sentAt            DateTime?
  link              String?
  readAt            DateTime?
  dedupeKey         String    @unique
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([status, scheduledFor])
  @@index([patientId, createdAt])
  @@index([appointmentId])
  @@index([channel, recipient, readAt])
}

model NotificationTemplate {
  id        String   @id @default(cuid())
  type      String
  channel   String
  subject   String?
  body      String
  isActive  Boolean  @default(true)
  updatedBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([type, channel])
}

model StaffNotification {
  id        String    @id @default(cuid())
  userId    String
  kind      String
  title     String
  body      String
  link      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt, createdAt])
}
```

Migration: `20261028174103_notifications`.

### Worker (`apps/worker/src/app/notification-worker.ts`)

```ts
onApplicationBootstrap(): void {
  const jobs: Job[] = [
    { name: 'dispatch',   everyMs: env('WORKER_POLL_MS', 5_000),                 run: () => this.dispatch() },
    { name: 'reminders',  everyMs: env('WORKER_REMINDER_SWEEP_MS', 5 * 60_000),  run: () => this.scheduler.ensureReminders() },
    { name: 'statements', everyMs: env('WORKER_STATEMENT_SWEEP_MS', 60 * 60_000), run: () => this.scheduler.statementReminders() },
  ];
  for (const job of jobs) {
    void this.tick(job);
    this.timers.push(setInterval(() => void this.tick(job), job.everyMs));
  }
}

private async tick(job: Job): Promise<void> {
  if (this.running.has(job.name)) return;          // never overlaps itself
  const work = job.run()
    .catch(err => this.logger.error(`${job.name} failed: ${err instanceof Error ? err.message : err}`))
    .finally(() => this.running.delete(job.name));
  this.running.set(job.name, work);
  await work;
}
```

Delivery providers are chosen from the environment: SendGrid if `SENDGRID_API_KEY` is set, Twilio if
`TWILIO_*` are set, otherwise the **dev outbox** writes each message to
`storage/outbox/<yyyy-mm-dd>/<id>-<channel>.txt`.

### UI

- Staff: header **notification bell**; patient profile **Communications** tab; calendar side panel
  lists each appointment's messages; **Settings › Notification templates** (merge-field chips, live
  preview, unknown-field validation, SMS segment count, active toggle, restore default);
  **Settings › Message log** (filters, _Send again_, cancel scheduled).
- Portal: notification bell in the header; new **Prescriptions** preference topic.

### Verification results (headless browser, 2026-10-28)

```text
* booked appointment: 201
* after booking: REMINDER_2H/SMS=QUEUED, REMINDER_2H/EMAIL=QUEUED, REMINDER_48H/SMS=QUEUED,
  REMINDER_48H/EMAIL=QUEUED, CONFIRMATION/SMS=SENT, CONFIRMATION/EMAIL=SENT
* after reschedule: old reminders CANCELLED, new reminders QUEUED, RESCHEDULED=SENT
* bell label: Notifications, 1 unread  → navigates to /messages?tab=updates
* failed messages: sms Appointment confirmation · Thomas Brennan … → after retry: Scheduled
* preview errors: Unknown merge field: {{bogus}}  (save disabled: true)
* preview: Thank you, James! We received $50.00. Remaining balance: $255.00.
* portal payment: 201 → portal receipt uses the customized template
* portal bell after "Mark all read": 0 unread
```

Fix found during verification: result-release notices showed "Ananya Patel" instead of the staff
display name "Dr. Ananya Patel, DO" (`patients.service.ts` now uses `displayName()`).

---

## 13. Database migrations

```text
prisma/migrations/
  20260511165647_init
  20260511173648_add_staff
  20260512120000_add_scheduling          (baseline for tables created by db push; marked applied)
  20261027183014_add_encounters          Phase 1
  20261028113148_add_billing             Phase 3
  20261028141502_staff_profiles_and_audit  Phase 4
  20261028152822_patient_portal          Phase 5
  20261028174103_notifications           Phase 6
```

Models: `Patient`, `Staff`, `StaffCredential`, `AuditLog`, `AppointmentType`, `Appointment`,
`Encounter`, `Prescription`, `EncounterTemplate`, `FeeSchedule`, `Invoice`, `Payment`,
`PaymentAllocation`, `InsuranceClaim`, `Counter`, `PatientAccount`, `MessageThread`,
`ThreadMessage`, `RefillRequest`, `ProfileChangeRequest`, `SavedPaymentMethod`, `Notification`,
`NotificationTemplate`, `StaffNotification`.

Creating a new migration:

```powershell
pnpm exec prisma migrate dev --name <short_name>
```

---

## 14. API endpoint reference

All routes are under `/api`. Staff routes require a staff JWT; `portal/*` routes require a patient
JWT.

| Area                  | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth (staff)          | `POST auth/login`, `GET auth/me`, `POST auth/change-password`, `POST auth/logout`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Patients              | `GET/POST patients`, `GET patients/mrn/:mrn`, `GET/PATCH/DELETE patients/:id`, `POST/DELETE patients/:id/allergies[/:allergyId]`, `POST patients/:id/documents`, `GET …/documents/:documentId/file`, `PUT …/documents/:documentId/sharing`, `DELETE …/documents/:documentId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Scheduling            | `GET/POST appointments`, `GET appointments/conflicts`, `GET appointment-types`, `GET/PATCH appointments/:id`, `POST appointments/:id/check-in`, `…/cancel`, `…/no-show`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Encounters            | `GET/POST encounters`, `GET encounters/by-appointment/:appointmentId`, `GET/PATCH/DELETE encounters/:id`, `POST encounters/:id/sign`, `…/addenda`, `…/prescriptions`, `POST prescriptions/check`, `PATCH prescriptions/:id`, `GET/POST encounter-templates`, `GET icd10/search`, `GET drugs/search`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Dashboard             | `GET dashboard?date&tzOffset&providerId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Billing               | `GET billing/summary`, `GET billing/statements/:patientId`, `GET/POST invoices`, `GET invoices/by-encounter/:encounterId`, `POST invoices/from-encounter/:encounterId`, `GET/PATCH invoices/:id`, `POST invoices/:id/issue`, `…/void`, `…/adjustments`, `GET/POST payments`, `POST payments/:id/void`, `GET/POST claims`, `PATCH claims/:id`, `GET/POST fee-schedules`, `GET/PUT fee-schedules/:id`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Staff                 | `GET/POST staff`, `GET staff/credentials/expiring`, `GET/PATCH staff/:id`, `PATCH staff/:id/account`, `POST staff/:id/reset-password`, `POST staff/:id/unlock`, `PUT staff/:id/schedule`, `POST staff/:id/credentials`, `PUT/DELETE staff/:id/credentials/:credentialId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Audit                 | `GET audit-logs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Care team             | `GET patients/:id/portal-access`, `POST …/portal-access/invite`, `PUT …/portal-access/status`, `GET inbox/summary`, `GET inbox/threads`, `GET/PATCH inbox/threads/:id`, `POST inbox/threads/:id/messages`, `GET refill-requests`, `POST refill-requests/:id/response`, `GET profile-change-requests`, `POST profile-change-requests/:id/review`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Notifications (staff) | `GET notifications`, `GET notifications/summary`, `POST notifications/:id/retry`, `POST notifications/:id/cancel`, `GET notification-templates`, `POST notification-templates/preview`, `PUT/DELETE notification-templates/:type/:channel`, `GET me/notifications`, `POST me/notifications/read`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Portal auth           | `POST portal/auth/login`, `…/register`, `…/activate`, `…/forgot-password`, `…/reset-password`, `GET portal/auth/me`, `POST portal/auth/change-password`, `POST portal/auth/logout`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Portal                | `GET portal/dashboard`; appointments & booking (`GET portal/appointments`, `GET portal/booking/types`, `…/providers`, `…/availability`, `POST portal/appointments`, `PUT portal/appointments/:id`, `POST portal/appointments/:id/cancel`); records (`GET portal/records/visits[/:id]`, `…/health`, `…/documents[/:id/file]`); refills (`GET/POST portal/refills`); billing (`GET portal/billing/summary`, `…/invoices[/:id]`, `GET/POST portal/billing/payments`, `GET/POST portal/billing/cards`, `PUT …/cards/:id/default`, `DELETE …/cards/:id`); messages (`GET/POST portal/messages`, `GET portal/messages/:id`, `POST portal/messages/:id/replies`); profile (`GET/PUT portal/profile`, `GET portal/profile/requests`, `GET/PUT portal/preferences`); `GET portal/notifications`, `POST portal/notifications/read` |

---

## 15. Environment variables

Copy [`.env.example`](../.env.example) to `.env`. All values are optional in development.

```dotenv
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="28800s"

# Uploaded documents and the development message outbox (storage/outbox/<date>/*.txt)
FILE_STORAGE_DIR="./storage"
# Set to "production" to stop logging invite codes / reset links (until email is configured)
APP_ENV="development"

# Practice details used in patient notifications
PRACTICE_NAME="Clinova Health"
PRACTICE_PHONE="(555) 010-0100"
PORTAL_URL="http://localhost:4300"
# IANA zone for message dates and SMS quiet hours (8am-9pm); defaults to the server's zone
PRACTICE_TIMEZONE="America/New_York"

# Email via SendGrid (otherwise messages go to the dev outbox)
SENDGRID_API_KEY=""
EMAIL_FROM=""

# SMS via Twilio (otherwise messages go to the dev outbox)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM=""

# Worker loop intervals (ms)
WORKER_POLL_MS=5000
WORKER_REMINDER_SWEEP_MS=300000
WORKER_STATEMENT_SWEEP_MS=3600000
```

---

## 16. Seed data and demo accounts

`pnpm exec prisma db seed` wipes and recreates demo data (appointments are relative to today).
These are **local demo credentials only** (defined in `prisma/seed.ts`).

| Role           | Email                                                                            | Password             |
| -------------- | -------------------------------------------------------------------------------- | -------------------- |
| Super admin    | `superadmin@clinova.health`                                                      | `Super@Admin2026`    |
| Practice admin | `admin@clinova.health`                                                           | `Admin@2026`         |
| Physician      | `dr.chen@clinova.health`, `dr.patel@clinova.health`                              | `Doctor@2026`        |
| Nurse          | `nurse.kim@clinova.health`                                                       | `Nurse@2026`         |
| Front desk     | `reception@clinova.health`                                                       | `Staff@2026`         |
| Billing        | `billing@clinova.health`                                                         | `Billing@2026`       |
| Portal patient | `j.okafor@email.com` (James Okafor), `tbrennan@constructco.com` (Thomas Brennan) | `Portal@Patient2026` |

Other seeded scenarios:

- Ruth Abernathy — critical Warfarin/Codeine allergies, checked in with Dr. Chen today.
- Diane Fletcher — portal invite code `FLET-CH26`; Priya Nair can self-register (matching name/DOB/email).
- 30 days of visit history, a no-show today, an overdue unsigned note.
- Five months of invoices/payments, claims at every stage, fee schedules.
- Staff profiles, schedules, credentials (some expiring within 30 days).
- Portal results, conversations, a refill request and a profile update.
- Notification history (incl. a failed SMS for Thomas and a suppressed email for Ruth) and five
  staff alerts.

---

## 17. Testing and verification

| Level                 | Where                                        | Command                                                                      |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| Domain unit tests     | `libs/*/domain/**/*.spec.ts`                 | `pnpm nx test notifications-domain`                                          |
| API integration tests | `apps/api/src/**/*.spec.ts` (temp SQLite DB) | `pnpm nx test api`                                                           |
| App component tests   | `apps/staff-web`, `apps/patient-portal`      | `pnpm nx test staff-web`                                                     |
| Full gate             | all projects except e2e                      | `pnpm nx run-many -t lint test build --exclude="*-e2e" --outputStyle=static` |

State after Phase 6: lint/test/build pass for **40 projects**; **88 API tests** (including 9
notification integration tests). Remaining lint output is warnings only (`no-explicit-any`,
`no-non-null-assertion`) plus staff-web bundle/style budget warnings.

### Headless browser walkthroughs

Scripts were written per phase (outside the repo) and run against the 3001/4301/4401 servers:

```js
// Resolve Playwright from the workspace so the script can live anywhere
const { chromium } = require(
  require.resolve('@playwright/test', { paths: ['C:/Pramod/Dev/ng/Clinova'] }),
);
const API = 'http://localhost:3001/api',
  STAFF = 'http://localhost:4401',
  PORTAL = 'http://localhost:4301';

async function token(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).accessToken;
}

async function staffLogin(page, email, pw) {
  await page.goto(STAFF + '/auth/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/dashboard/);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await staffLogin(page, 'admin@clinova.health', 'Admin@2026');
  await page.goto(STAFF + '/settings/message-log');
  await page.screenshot({ path: 'message-log.png', fullPage: true });
  await browser.close();
})();
```

```powershell
node .\walkthrough.cjs
```

---

## 18. Troubleshooting and gotchas

**Nx / pnpm**

- Always run tasks through Nx: `pnpm nx <target> <project>`.
- PowerShell splits unquoted commas: use `"--projects=a,b"`; otherwise Nx reports "No tasks were run".
- After moving or generating libraries, run `pnpm nx reset` (stale project graph).

**PowerShell**

- No `&&` / `||` in Windows PowerShell 5 — use `;` and `if ($?) { … }`.
- Double-quoted strings interpolate `${...}` and `$var` — use single quotes or here-strings
  (`@' … '@`) when writing TypeScript template literals.
- `2>&1` on native commands shows harmless `NativeCommandError` text; `git commit` may exit -1 due
  to stderr warnings (LF→CRLF) even when it succeeded.
- Many files use CRLF line endings — normalise when doing scripted string replacements.

**API / worker**

- Webpack bakes `NODE_ENV=production` into the api/worker bundles; use `APP_ENV` for dev-only
  behaviour (e.g. logging invite codes).
- Restart the API after migrations — the Prisma client and modules load at startup.
- The worker logs little through `nx serve worker`; confirm activity in **Settings › Message log**
  or in `storage/outbox/`.
- `GET /api/staff` must never include `passwordHash` (fixed in Phase 1).

**Angular**

- Theme is Material M2: `mat-flat-button` needs `color="primary"` to be filled.
- Icons use the classic Material Icons font (names like `clinical_notes` do not exist).
- Component style budget: warn 4 kB, error 8 kB — split large components.
- No arrow functions in templates; wrap `??` in parentheses before pipes; `inject()` is not allowed
  inside `computed()`; use `untracked()` in effects that call APIs.
- Interpolations cannot contain a literal `}}` (precompute strings such as `{{merge_field}}` chips).
- Views use `withViewTransitions` — wait ~1.5 s after navigation before screenshots.

**Domain / data**

- CPT descriptions are AMA-copyrighted; the seed uses plain-language descriptions.
- Reseeding wipes all data in `dev.db`; back up first if needed
  (`Copy-Item dev.db dev.db.bak`).

---

## 19. Deferred items and next steps

**Phase 7 — Reports & analytics (next)** · PRD §4.7: report catalogue in
`libs/reporting/feature-reports`, operational, clinical, financial and staff reports with filters,
charts and CSV/PDF export, using the permission matrix.

**Phase 8 — Hardening (planned)**

- PostgreSQL instead of SQLite.
- Redis + BullMQ replacing the database-polling worker.
- MFA, refresh tokens, staff time off and schedule-aware booking.
- S3-compatible document storage; real payment processor; real email/SMS providers in production.
- Move remaining API modules into `libs/api/*`.

**After pulling these changes**

```powershell
pnpm install
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm nx serve api            # terminal 1
pnpm nx serve worker         # terminal 2
pnpm nx serve staff-web      # terminal 3
pnpm nx serve patient-portal # terminal 4
```
