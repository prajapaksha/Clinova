# Patient Management System — Product Requirements Document

**Web & Mobile Application for Doctor's Offices**

Prepared for: UI/UX Design Team (Stitch)
Document Version: 1.0
Date: April 2026

---

## 1. Document Overview

### 1.1 Purpose

This document defines the functional, non-functional, and design requirements for a Patient Management System (PMS) intended for use by small doctor's offices and clinics with 2–10 practitioners. It serves as the primary input for the UI/UX design team working in Stitch (Google's AI-powered design tool), with downstream handoff to Figma and to Angular Material implementation.

The document specifies what the system must do, what data it must handle, what screens are needed, and what the user experience should feel like. It does not prescribe specific visual styling — that is the design team's responsibility — but it does provide content structure, hierarchy, interaction expectations, and a complete information architecture.

### 1.2 Scope

**In scope for version 1.0:**

- Patient profile management (demographics, medical history, documents, insurance)
- Appointment scheduling and calendar management for doctors and rooms
- Doctor and staff profile management with role-based access
- Billing, invoicing, and payment processing
- Clinical encounter notes (SOAP format) and prescription management
- Patient-facing portal for self-scheduling, document access, and messaging
- Reporting and analytics dashboard for practice administrators
- Notifications and reminders (email, SMS, in-app)

**Out of scope for version 1.0:**

- Telehealth video consultation (planned for v2.0)
- Lab system integration (HL7/FHIR — planned for v2.0)
- Insurance claims clearinghouse integration
- Inventory and pharmacy stock management

### 1.3 Target Audience for This Document

- UI/UX designers building screens, components, and design systems
- Product managers prioritizing the build backlog
- Frontend and backend engineers translating designs to code
- QA and compliance reviewers

### 1.4 Implementation Stack at a Glance

The technology stack is defined upfront and detailed in Section 12. In summary: Nx monorepo, Angular with Angular Material on the frontend, NestJS with PostgreSQL on the backend, all organized using Domain-Driven Design. Designers should read Section 12 before generating designs in Stitch, as Angular Material's structure directly influences the prompts, references, and design system descriptions used to drive Stitch output.

### 1.5 Glossary

| Term | Definition |
| --- | --- |
| PMS | Patient Management System — the product described in this document. |
| EHR/EMR | Electronic Health Record / Electronic Medical Record — the clinical data subset. |
| SOAP Note | Subjective, Objective, Assessment, Plan — standard clinical encounter format. |
| MRN | Medical Record Number — unique patient identifier within the practice. |
| NPI | National Provider Identifier — unique 10-digit ID for U.S. healthcare providers. |
| RBAC | Role-Based Access Control — permissioning model used throughout the system. |
| PHI | Protected Health Information — sensitive patient health data that requires extra care in handling, access, and storage. |
| No-Show | An appointment the patient missed without canceling. |
| Encounter | A single clinical visit or interaction recorded in the system. |
| DDD | Domain-Driven Design — software architecture approach that organizes code around business domains rather than technical layers. |
| Bounded Context | In DDD, a logical boundary within which a particular domain model applies (e.g., "billing" and "clinical" are separate contexts). |
| Nx | Build system and monorepo tool used to organize multiple applications and libraries in one repository with strict dependency rules. |
| Angular Material | Official Angular UI component library implementing Google's Material Design specification. |

---

## 2. Goals and Success Metrics

### 2.1 Business Goals

- Reduce administrative time per patient by at least 30% compared to paper-based workflows.
- Reduce no-show rate by at least 20% through automated reminders and easy rescheduling.
- Centralize patient data so any authorized staff member can serve any patient within 30 seconds of opening their record.
- Maintain a complete audit trail for every patient record interaction so the practice always knows who did what and when.

### 2.2 User Goals

- **Doctors:** see today's schedule, open the next patient's chart, and write a note in fewer than three clicks.
- **Front-desk staff:** book, reschedule, or check in a patient without switching screens.
- **Billing staff:** process a payment and issue a receipt in under one minute.
- **Patients:** book an appointment, view past visits, and pay a bill from a single portal.

### 2.3 Key Performance Indicators

| Metric | Target | Notes |
| --- | --- | --- |
| Time to book an appointment (staff) | < 45 seconds | Time from patient record open to confirmation. |
| Time to check in a patient | < 20 seconds | From walk-in to status: Checked-In. |
| Time to record a SOAP note | < 5 minutes | Average across all encounter types. |
| No-show rate | < 8% | Reminders sent at 48h and 2h before appointment. |
| System uptime | 99.9% | Excluding planned maintenance windows. |
| Patient portal adoption | > 60% | % of active patients with portal accounts after 6 months. |

---

## 3. User Roles and Permissions

### 3.1 Role Definitions

| Role | Description |
| --- | --- |
| Super Admin | Practice owner / IT lead. Full system access including user management, billing configuration, and audit logs. |
| Practice Administrator | Manages staff schedules, fee schedules, reports, and clinic settings. Cannot delete audit logs. |
| Doctor / Provider | Views own and shared schedules. Full access to clinical records of their patients. Can prescribe and sign notes. |
| Nurse / Medical Assistant | Reads patient charts, records vitals, prepares notes for doctor review. Cannot sign clinical notes. |
| Front Desk / Receptionist | Schedules appointments, manages check-in/check-out, collects payments. Limited clinical view (allergies, alerts only). |
| Billing Specialist | Full access to invoices, payments, insurance, and financial reports. No clinical access beyond billable services. |
| Patient | Self-service portal access to own records, appointments, documents, and billing only. |

### 3.2 Permissions Matrix

`F = Full, R = Read-only, L = Limited (subset), — = No access.` Permissions are configurable per practice.

| Capability | Super Admin | Admin | Doctor | Nurse | Front Desk | Billing | Patient |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Patient profiles | F | F | F | R | L | L | — |
| Clinical notes (SOAP) | F | R | F | L | — | — | — |
| Appointments | F | F | F | F | F | R | L |
| Prescriptions | F | R | F | R | — | — | R |
| Invoices & payments | F | F | R | — | L | F | L |
| Doctor profiles | F | F | L | L | L | L | L |
| Reports & analytics | F | F | L | — | — | L | — |
| System settings | F | L | — | — | — | — | — |
| User management | F | L | — | — | — | — | — |
| Audit logs | F | R | — | — | — | — | — |

---

## 4. Functional Requirements — Core Modules

This section describes each functional module. For every module: purpose, key entities, primary user flows, and screen-level requirements that the design team can translate directly into Stitch prompts and screen designs.

### 4.1 Patient Management Module

**Purpose:** Centralized repository of all patient demographic, contact, medical, insurance, and document information. This is the gravitational center of the system — most other modules link back to a patient record.

**Key Data Fields:**

| Group | Fields |
| --- | --- |
| Identity | MRN (auto), Title, First name, Middle name, Last name, Preferred name, DOB, Sex assigned at birth, Gender identity, Pronouns, Photo. |
| Contact | Primary phone, Secondary phone, Email, Preferred contact method, Mailing address, Billing address. |
| Emergency | Emergency contact name, relationship, phone (up to 2 contacts). |
| Medical | Blood type, Height, Weight, Allergies (with severity), Chronic conditions, Current medications, Past surgeries, Family history, Immunization log. |
| Insurance | Primary insurance: provider, policy #, group #, subscriber relationship, effective dates, copay, deductible. Secondary insurance (same fields). |
| Demographics | Marital status, Occupation, Preferred language, Ethnicity (optional), Communication preferences. |
| Documents | Uploaded files (PDF, images): consent forms, lab reports, referrals, prior records. |
| Flags & Alerts | Critical alerts (e.g., severe allergies), VIP flag, Outstanding balance flag, Custom tags. |
| Consent & Privacy | Date of privacy policy acknowledgement, marketing consent, telehealth consent, release-of-info authorizations. |

**Primary User Flows:**

1. **Register new patient** — multi-step form wizard (Identity → Contact → Insurance → Medical → Consent).
2. **Search patient** — global search bar by name, DOB, MRN, or phone with type-ahead suggestions.
3. **View patient summary** — single-screen overview showing alerts, demographics, last visit, upcoming appointments, balance due.
4. **Edit patient information** — inline edit with field-level audit logging.
5. **Upload document** — drag-and-drop with category selection and preview.
6. **Merge duplicate patients** — admin-only action with conflict resolution view.

**Required Screens:**

- Patient List — sortable, filterable table with bulk actions.
- Patient Profile (Summary tab) — at-a-glance dashboard for one patient.
- Patient Profile (Medical tab) — allergies, medications, conditions, history.
- Patient Profile (Appointments tab) — chronological list, past and upcoming.
- Patient Profile (Documents tab) — file gallery with categories.
- Patient Profile (Billing tab) — invoices, payments, balance, insurance claims.
- Patient Profile (Notes tab) — clinical encounter history.
- New Patient Registration — multi-step wizard.
- Merge Patients — admin utility.

**Acceptance Criteria:**

- MRN must be unique within the practice and auto-generated on creation.
- Allergies marked Severe must trigger a persistent banner on every patient screen.
- Soft delete only — patient records are never hard-deleted; instead they are archived and recoverable.
- Every field edit is logged with user, timestamp, old value, new value.

### 4.2 Appointment & Scheduling Module

**Purpose:** Manage appointment booking, calendar views, room assignments, recurring slots, waitlists, and check-in workflows.

**Appointment Statuses:**

| Status | Meaning | Suggested Color Treatment |
| --- | --- | --- |
| Scheduled | Booked but not yet confirmed by patient. | Gray |
| Confirmed | Patient acknowledged via email/SMS reply. | Blue |
| Checked-In | Patient has arrived and is in the waiting area. | Yellow |
| In-Progress | Patient is with the provider. | Purple |
| Completed | Encounter finished and notes signed. | Green |
| Cancelled | Cancelled by patient or staff with reason. | Light gray |
| No-Show | Patient did not arrive within grace period. | Red |
| Rescheduled | Linked to a new appointment. | Orange |

**Calendar Views:**

- **Day view** — vertical time axis, doctors as columns, appointments as colored blocks.
- **Week view** — 7-day grid with doctor filter; appointments shown compactly.
- **Month view** — overview with appointment counts per day; click drills into day.
- **Agenda / List view** — chronological list, filterable by doctor, status, type.
- **Resource view** — by room, equipment, or doctor as horizontal swim lanes.

**Primary User Flows:**

1. **Book appointment from calendar** — click time slot → select patient → select type, duration, doctor → confirm.
2. **Book appointment from patient record** — "New Appointment" CTA opens slot picker filtered to that patient's preferred doctor.
3. **Drag to reschedule** — drag appointment block to new time/doctor; system prompts to notify patient.
4. **Recurring appointment series** — weekly therapy, monthly check-in; edit one or all instances.
5. **Add to waitlist** — when no slot available, add patient with preferred date range; auto-suggest cancellations.
6. **Check in** — front desk one-click action; updates status and starts wait timer.
7. **Cancel / mark no-show** — requires reason from preset list.

**Required Screens:**

- Calendar (default landing for clinical staff) with view switcher and filters.
- New Appointment dialog / side panel.
- Appointment detail panel — patient info, type, status actions, notes, reminder log.
- Waitlist management view.
- Check-in / Today's Roster screen — front desk dashboard.
- Recurring series editor.

**Business Rules:**

- No double-booking for the same provider unless explicitly overridden by Admin.
- Default appointment durations are configurable per appointment type (e.g., new patient = 45 min, follow-up = 15 min).
- Buffer time between appointments is configurable per provider.
- Patients with > 3 no-shows in 12 months trigger a soft warning when booking.

### 4.3 Doctor & Staff Management Module

**Purpose:** Maintain provider and staff profiles, schedules, working hours, time off, and credentials.

**Key Data Fields:**

| Group | Fields |
| --- | --- |
| Identity | Title (Dr., NP, PA), First, Last, Suffix, Photo, Display name. |
| Credentials | NPI, DEA (for prescribers), Medical license #, State, Expiration, Board certifications, Specialties. |
| Contact | Work email, Direct phone, Office location. |
| Schedule | Working hours per day of week, Lunch break, Recurring time off, One-off time off. |
| Service config | Appointment types this provider supports, Default appointment durations, Booking buffer. |
| Billing | Default fee schedule, Insurance networks accepted. |
| System | Role, Active/inactive, Last login, MFA status. |

**Required Screens:**

- Staff Directory — list of all providers and staff, filterable by role, status, specialty.
- Provider Profile — public-facing info shown in patient portal (bio, specialties, photo).
- Provider Schedule Editor — weekly template + exceptions.
- Time Off Manager — request, approve, view conflicts.
- Credential Tracker — license expirations with alerts at 90 / 30 / 7 days out.

### 4.4 Clinical Encounter & Notes Module

**Purpose:** Record clinical encounters, vitals, diagnoses, prescriptions, and treatment plans in a structured, signable format.

**SOAP Note Structure:**

| Section | Contents |
| --- | --- |
| Subjective | Chief complaint, history of present illness, patient-reported symptoms, review of systems. |
| Objective | Vitals (BP, HR, temp, resp, SpO2, weight, height, BMI), physical exam findings, lab/imaging results referenced. |
| Assessment | Diagnoses (ICD-10 coded with search), differential diagnoses, clinical reasoning. |
| Plan | Treatment plan, prescriptions issued, orders (labs, imaging, referrals), patient education, follow-up instructions. |

**Primary User Flows:**

1. **Start encounter** — from a Checked-In appointment, doctor clicks "Begin Encounter" → status flips to In-Progress and opens note editor.
2. **Record vitals** — nurse enters before doctor sees patient; values pre-fill the Objective section.
3. **Use template** — select from specialty-specific templates (annual physical, well-child, follow-up, etc.).
4. **Search ICD-10 / CPT codes** — type-ahead with code, description, and frequency-of-use ranking.
5. **Prescribe medication** — search drug database, set dose / frequency / duration / refills, check interactions and allergies.
6. **Sign and complete note** — locks the note for editing; subsequent changes require an addendum.

**Required Screens:**

- Encounter Note Editor — split-pane layout: structured fields on left, patient context on right.
- Vitals Entry — quick entry form, ideally usable on tablet.
- Prescription Composer — drug search, dosing, refills, send-to-pharmacy.
- Note History / Timeline — chronological view of all encounters for a patient.
- Addendum Editor — for adding to signed notes.
- Template Manager — admin/doctor area to create and share templates.

### 4.5 Billing, Invoicing & Payments Module

**Purpose:** Generate invoices from encounters, accept payments via multiple channels, manage insurance claims (manual stage), and track accounts receivable.

**Key Concepts:**

- **Fee Schedule** — practice-wide pricing per service code (CPT). Multiple schedules can exist (cash-pay vs. insured).
- **Invoice** — generated automatically when an encounter is signed, line-itemized by service.
- **Payment** — can be applied to one or more invoices; supports partial payments and overpayments.
- **Adjustments** — write-offs, insurance contractual adjustments, courtesy discounts.
- **Insurance Claim** — tracked manually in v1.0 with status (Draft → Submitted → Paid / Denied / Pending).

**Payment Methods:**

- Credit/debit card (via integrated payment processor — Stripe or Square recommended).
- ACH / bank transfer.
- Cash.
- Check (record check #).
- HSA/FSA card.
- Patient portal self-pay.

**Required Screens:**

- Billing Dashboard — total AR, aging buckets (0-30, 31-60, 61-90, 90+), today's collected.
- Invoice List — filter by status (Draft, Sent, Partially Paid, Paid, Overdue, Voided).
- Invoice Detail — line items, payments applied, balance, history; PDF export.
- Take Payment dialog — select invoice(s), amount, method, optional receipt destination.
- Insurance Claim Tracker — list view with status pipeline.
- Fee Schedule Editor — admin only.
- Statements — generate and send patient statements (single or batch).

**Business Rules:**

- Invoices are immutable once paid; corrections require a credit memo.
- All payment processor failures are logged and surfaced in a queue.
- Refunds require a reason and a Practice Admin or Billing Specialist approval.

### 4.6 Notifications & Reminders Module

**Channels:**

- Email (transactional and marketing-suppressed).
- SMS (with opt-in compliance per TCPA / regional law).
- In-app notification center with bell icon and unread count.
- Patient portal inbox.

**Notification Types:**

| Trigger | Channel(s) | Timing |
| --- | --- | --- |
| Appointment confirmation | Email + SMS | Immediately on booking. |
| Appointment reminder | Email + SMS | 48 hours and 2 hours before. |
| Reschedule / cancellation | Email + SMS | Immediately. |
| No-show follow-up | Email | Same day, with link to rebook. |
| Invoice issued | Email + Portal | On generation. |
| Payment receipt | Email + Portal | On successful payment. |
| Statement / balance reminder | Email | 30 days, 60 days overdue. |
| New document available | Portal + Email | On upload by staff. |
| Prescription refill ready | Email + SMS | On pharmacy confirmation. |
| Lab results ready | Portal | On staff release (doctor controls visibility). |

**User Controls:**

- Patients can opt in/out of each channel per notification type from the portal.
- Staff can configure templates per notification type with merge fields (`{{patient_first_name}}`, `{{appointment_time}}`, etc.).
- All sent notifications are logged in the patient record and viewable from the appointment detail.

### 4.7 Reporting & Analytics Module

**Standard Reports:**

- Daily schedule summary — appointments per provider, expected revenue, no-show count.
- Revenue report — by day / week / month, by provider, by service type, by payer.
- Accounts receivable aging.
- Patient demographics — age, gender, insurance mix.
- Appointment analytics — cancellation rate, no-show rate, average wait time, average encounter duration.
- Provider productivity — encounters, RVUs (if configured), revenue.
- Outstanding tasks — unsigned notes, unbilled encounters, pending claims.

**Required Screens:**

- Reports landing page — categorized cards.
- Report viewer — filters at top, chart + table, export to CSV / PDF.
- Custom report builder (v1.5 — defer if needed).
- Practice Admin Dashboard — KPI tiles, charts, alerts.

### 4.8 Patient Portal (Patient-Facing)

**Purpose:** Self-service web (and responsive mobile) interface for patients to interact with the practice without needing to call.

**Patient-Facing Features:**

- Account creation and login (with MFA option).
- Dashboard — next appointment, balance due, recent documents, unread messages.
- Self-scheduling — book appointments with their providers based on real-time availability.
- Reschedule / cancel within practice-defined cutoff.
- View past visits and download visit summaries.
- View and download lab results (when released by doctor).
- Pay invoices with saved payment methods.
- Update demographics, insurance, contact info (changes flagged for staff review).
- Secure messaging with the care team (non-urgent only — clear disclaimer).
- Request prescription refills.
- Manage notification preferences.

**Required Screens:**

- Login / Register / Forgot Password.
- Patient Dashboard.
- Book an Appointment — provider selection → date → time → reason → confirm.
- My Appointments — upcoming and past.
- My Documents.
- My Bills — outstanding and history.
- Pay Now flow.
- Messages.
- Profile & Preferences.

---

## 5. Non-Functional Requirements

### 5.1 Security

- All data in transit encrypted via TLS 1.3 minimum.
- All data at rest encrypted using AES-256.
- Mandatory MFA for all staff roles.
- Session timeout: 15 minutes of inactivity for staff, 30 minutes for patients.
- Password policy: minimum 12 characters, complexity rules, rotation every 90 days for staff.
- Brute-force protection: account lockout after 5 failed attempts.
- Field-level audit logging for all patient record access (who accessed what record, when).

### 5.2 Performance

- Page load: 95th percentile under 2 seconds on broadband.
- Search results: 95th percentile under 500 ms.
- Calendar with 50 appointments per day per provider must render in under 1 second.
- Support 100 concurrent staff users per practice without degradation.

### 5.3 Availability & Reliability

- 99.9% uptime SLA (excluding planned maintenance).
- Daily encrypted backups with 30-day retention; tested restore quarterly.
- Disaster recovery: RTO ≤ 4 hours, RPO ≤ 1 hour.

### 5.4 Scalability

Designed for small clinic (2–10 providers). The data model and architecture should not preclude scaling to multi-location group practices later, but the v1.0 product is explicitly tuned for the small-clinic use case — onboarding, defaults, and UI density should reflect that.

### 5.5 Browser & Device Support

| Platform | Support level |
| --- | --- |
| Desktop | Chrome, Edge, Firefox, Safari — last 2 major versions. |
| Tablet | iPad (Safari, Chrome) — fully supported for clinical workflows (vitals, notes). |
| Mobile (staff) | Responsive web; native app deferred to v2.0. |
| Mobile (patient portal) | Responsive web required for v1.0; native app on roadmap. |

### 5.6 Internationalization

- All UI text externalized for translation; English at launch.
- Date, time, currency, and phone number formatting per locale.
- Time zones handled per practice and per user.

---

## 6. Information Architecture & Navigation

### 6.1 Top-Level Navigation (Staff App)

A persistent left sidebar with the following primary destinations, collapsible to icons-only for more screen real estate:

- Dashboard (role-aware home)
- Calendar / Appointments
- Patients
- Encounters / Notes (queue of own pending)
- Billing & Payments
- Reports
- Staff & Schedules
- Messages
- Settings

### 6.2 Top Bar (Staff App)

- Global patient search (always-visible, keyboard shortcut: `/`).
- Quick-create button (+) — new patient, new appointment, new invoice, new note.
- Notification bell with unread count.
- Help / shortcuts.
- User avatar with profile, switch role (if multiple), log out.

### 6.3 Top-Level Navigation (Patient Portal)

- Home / Dashboard
- Appointments
- Health Records
- Billing
- Messages
- Profile

### 6.4 Sitemap Summary

| Section | Contents |
| --- | --- |
| Staff: Dashboard | Today summary, alerts, pending tasks. |
| Staff: Calendar | Day / Week / Month / Agenda / Resource views, filters. |
| Staff: Patients | List → Profile (Summary, Medical, Appointments, Documents, Billing, Notes). |
| Staff: Encounters | My pending notes, all encounters, templates. |
| Staff: Billing | Dashboard, Invoices, Payments, Claims, Statements, Fee schedules. |
| Staff: Reports | Standard reports, exports, dashboard. |
| Staff: Staff | Directory, Schedules, Time off, Credentials. |
| Staff: Messages | Inbox, sent, secure patient messages. |
| Staff: Settings | Practice info, users, roles, notification templates, integrations. |
| Patient: Dashboard | Next appointment, balance, recent activity. |
| Patient: Appointments | Book new, list of mine, reschedule, cancel. |
| Patient: Health Records | Visit summaries, lab results, documents, medications, allergies. |
| Patient: Billing | Pay now, invoice list, payment methods, statements. |
| Patient: Messages | Inbox, compose new (non-urgent disclaimer). |
| Patient: Profile | Demographics, insurance, contact, preferences, password / MFA. |

---

## 7. UX and Design Guidelines for the Design Team

This section is written specifically for designers working in Stitch. It defines what the design system should establish before screen generation begins, and how to structure prompts and references so Stitch produces output consistent with Angular Material.

### 7.1 Design Principles

- **Calm by default.** Healthcare staff work under cognitive load and time pressure. Avoid visual noise, aggressive colors, and competing CTAs. Reserve emphasis for clinically important information (allergies, alerts, overdue balances).
- **Information density without clutter.** Clinicians need a lot of data on one screen. Use clear hierarchy, consistent spacing, and progressive disclosure rather than truncation.
- **Keyboard first.** Front-desk and clinical workflows are repetitive. Every primary action must be reachable by keyboard with documented shortcuts.
- **Forgiving of mistakes.** Confirmation for destructive actions; undo where feasible; never lose unsaved data on navigation.
- **Patient portal is friendlier.** The patient-facing portal can be warmer, more spacious, more reassuring. The staff app should feel like a precision tool; the portal should feel like a calm waiting room.

### 7.2 Design Tokens to Define

The frontend will be built using Angular Material (see Section 12 for the full technology stack). The design system should be a customized Material 3 (M3) theme — extending Material's token structure rather than inventing a parallel one. In Stitch, this means including explicit token definitions (color palette, typography scale, spacing) in the project's design system description and reference assets so the AI generates output aligned with Material 3 conventions.

Establish these foundational tokens before generating screens, and document them in a way Stitch can reference (system prompt, style guide image, or anchor screen):

**Color**

- Primary brand color (and hover, active, disabled, focus states).
- Neutrals: at least 9 steps of gray for backgrounds, borders, text.
- Semantic colors: success, warning, danger, info — each with background, border, and text variants.
- Status colors: appointment statuses (see 4.2), invoice statuses, encounter statuses.
- Clinical accents reserved for critical alerts only (e.g., severe allergy red — do not reuse this red anywhere else).

**Typography**

- One sans-serif family for UI (e.g., Inter, IBM Plex Sans, or system stack).
- Type scale: at least Display, H1, H2, H3, Body Large, Body, Body Small, Caption, Label, Code/Mono.
- Reserve a monospace style for medical record numbers, codes (ICD-10, CPT), and dosages.

**Spacing**

- 4px base grid; spacing scale of 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Standard form field height: 40px (touch-friendly).
- Standard table row height: 48px for clinical lists, 40px for compact admin tables.

**Elevation & Radius**

- 4 elevation levels: flat, raised (cards), overlay (modals), popover.
- Radius scale: 4px (inputs), 8px (cards), 12px (modals), full (avatars, pills).

**Iconography**

- Use Material Symbols (the icon set that ships with Angular Material) as the default. Supplement with custom icons only where Material Symbols is missing a clinically meaningful glyph.
- Standard sizes: 20px (inline), 24px (default), 40px (large / empty states).
- Avoid medical-symbol clichés (caduceus, red crosses) in primary navigation — they clutter quickly.

### 7.3 Component Library Requirements

Most of these components map directly to Angular Material primitives (see Section 12.4 for the mapping table). When generating screens in Stitch, designers should explicitly reference Angular Material component names in prompts (e.g., "use a MatCard layout for the patient summary", "use MatTable with sticky header for the appointment list") so the AI produces output that matches what engineering will actually build. After generation, screens should be exported to Figma where reusable components and variants can be properly defined.

The design system should account for the following components, at minimum:

- Buttons (primary, secondary, tertiary, destructive, ghost, icon-only, all with loading and disabled states).
- Input fields (text, email, phone, date, time, select, multi-select, search, textarea), each with label, helper text, error, success states.
- Form layouts (single column, two column, inline).
- Tables (sortable headers, row selection, expandable rows, sticky header, empty state, loading state, pagination).
- Cards (patient summary card, appointment card, invoice card).
- Modal and side panel (slide-over) patterns.
- Toast notifications and inline alerts (info, success, warning, danger).
- Tabs, accordions, breadcrumbs, pagination.
- Calendar components: day cell, time slot, appointment block, mini-calendar.
- Status badges (appointment, invoice, claim, encounter).
- Patient avatar with initials fallback, alert indicator overlay.
- Search-with-results dropdown (used for patient search, ICD-10, drug search).
- Empty states (illustrated).
- Skeleton loaders for tables, cards, and detail views.

### 7.4 Critical Interaction Patterns

- Patient context never leaves the screen — when a user is inside a patient record, the patient name, MRN, DOB, age, allergies, and balance must be visible at all times (sticky header pattern recommended).
- Allergy and alert banners are always at the top of patient screens, full-width, in the reserved alert color.
- Drag-and-drop on the calendar must show a real-time conflict indicator if dropping would double-book.
- Forms autosave drafts every 10 seconds; "Saving…" / "Saved" indicator visible.
- Destructive actions (delete patient document, void invoice, cancel appointment) require confirmation modal with explicit action verb (not "OK").
- Long lists use virtualized rendering with sticky filters.

### 7.5 Accessibility Requirements

- All color combinations meet WCAG 2.2 AA contrast ratios (4.5:1 for body text, 3:1 for large text).
- Focus states must be visible and use a 2px outline distinct from hover.
- All interactive elements reachable by keyboard in logical tab order.
- ARIA labels on all icon-only buttons.
- Form error messages associated with inputs and announced to screen readers.
- Calendar must be operable with keyboard (arrow keys to navigate, Enter to book).
- Do not rely on color alone to convey status — pair with icon or text.

### 7.6 Responsive Behavior

| Breakpoint | Range | Behavior |
| --- | --- | --- |
| Small (mobile) | < 640 px | Patient portal only. Staff app shows a "Use desktop or tablet" message. |
| Medium (tablet) | 640 – 1024 px | Staff app: clinical workflows fully supported. Sidebar collapses to icons. |
| Large (laptop) | 1024 – 1440 px | Staff app default. Full sidebar, multi-column layouts. |
| XL (desktop) | > 1440 px | Two-pane layouts (e.g., note editor with patient context side-by-side). |

### 7.7 Working Effectively in Stitch

Stitch is a prompt-driven, AI-powered design tool. This changes the design workflow in ways the team should plan for explicitly.

**Recommended Workflow:**

1. Establish the design system in Stitch first — feed it the Material 3 token definitions, brand colors, typography scale, and any existing reference imagery before generating screens.
2. Generate one anchor screen per module (e.g., Patient Profile Summary, Calendar Day View, Invoice Detail). Iterate on these until they reflect the desired aesthetic and Material 3 alignment. These become the visual reference for all related screens.
3. Use anchor screens as references when prompting Stitch for additional screens in the same module — this keeps consistency higher than starting each screen from scratch.
4. Export to Figma once a module's screens are stable. Stitch is for generation and iteration; Figma is where the team formalizes components, variants, auto-layout, and developer handoff.
5. Use the Stitch HTML/CSS export as a reference for the Angular team, but treat the Angular Material implementation as the source of truth — Stitch's HTML will not use Material components.

**Prompting Guidance:**

- Reference Angular Material component names directly in prompts ("MatTable", "MatCard", "MatStepper for the new patient wizard").
- Specify density when relevant ("high-density Material table" for clinical staff screens; "comfortable density" for patient portal screens).
- Include context about the user role and task ("a screen for a front-desk receptionist checking in patients during a busy morning") — Stitch produces better output when given user context, not just visual instructions.
- Constrain tone explicitly: staff app prompts should mention "clinical", "information-dense", "calm"; patient portal prompts should mention "reassuring", "spacious", "approachable".
- Keep one source of truth for the design system — paste the same token definitions and component conventions into every project or prompt to avoid drift between screens.

**Known Limitations to Plan For:**

- Stitch does not produce reusable component libraries the way Figma does. Component reusability is established after export, in Figma.
- Stitch's interactive prototyping is limited compared to Figma. For complex flows (multi-step forms, calendar interactions), build prototypes in Figma after export.
- Stitch output may produce styling that looks Material-adjacent but is not actually Material 3 — always validate against Angular Material's component documentation before approving for handoff.
- Accessibility annotations are not a Stitch strength. Add these in Figma post-export, or directly in this requirements document on a per-screen basis.

---

## 8. Integrations

| Integration | Suggested provider | Notes |
| --- | --- | --- |
| Payment processor | Stripe or Square | Card vault, recurring billing, ACH. Required v1.0. |
| Email | SendGrid or AWS SES | Transactional email. Required v1.0. |
| SMS | Twilio | Reminders and notifications. Required v1.0. |
| Calendar sync | Google / Outlook (read-only push) | Mirror provider schedules. Required v1.0. |
| e-Prescribing | Surescripts (via partner) | Required for any controlled prescriptions in U.S. v1.5. |
| Lab results | HL7 v2 / FHIR via Mirth or Redox | Auto-import results. v2.0. |
| Telehealth | Zoom for Healthcare or Doxy.me | v2.0. |
| Insurance verification | Change Healthcare or Availity | Real-time eligibility. v1.5. |
| Identity / SSO | SAML 2.0 / OIDC | For enterprise practice deployments. v1.5. |
| Object storage | AWS S3 (encrypted) | Patient documents. Required v1.0. |

---

## 9. High-Level Data Model

A simplified entity overview to align designers, engineers, and reviewers. This is not the database schema.

| Entity | Description |
| --- | --- |
| Practice | Top-level tenant. Owns all other entities. |
| Location | Physical office. A practice can have one or many. |
| User | Any human with a login. Has one or more Roles. |
| Role | Permission set. Assigned to Users. |
| Provider | Subtype of User with clinical credentials. |
| Patient | Person receiving care. Linked to a Practice. |
| AppointmentType | Configurable: name, default duration, color, eligible providers. |
| Appointment | Scheduled event linking Patient, Provider, Location, AppointmentType, Status. |
| Encounter | Clinical record produced from an Appointment. Contains SOAP sections. |
| Vital | Discrete measurement attached to an Encounter. |
| Diagnosis | ICD-10 code attached to an Encounter. |
| Prescription | Medication order linked to Encounter and Patient. |
| Document | File attached to a Patient (consent, lab, image, etc.). |
| InsurancePolicy | Coverage attached to a Patient. |
| FeeSchedule | Mapping of CPT code to price. |
| Invoice | Generated from one or more Encounters. |
| InvoiceLine | Line item: service, code, quantity, amount. |
| Payment | Money received, applied to one or more Invoices. |
| Claim | Insurance claim, links to Invoice and InsurancePolicy. |
| Notification | Outbound message log. |
| AuditLog | Immutable record of every patient record access and data change. |

---

## 10. Key User Journeys

End-to-end narratives that the design team can use to storyboard and validate flows.

### 10.1 New Patient End-to-End

1. Patient calls or self-registers via the portal.
2. Front desk creates patient record (or approves portal registration), captures insurance, sends digital intake forms via portal link.
3. Patient completes intake forms from home; data auto-populates the record on submit.
4. Front desk books the appointment; confirmation and reminders sent automatically.
5. Day of: patient checks in via front desk or self-check-in kiosk (future).
6. Nurse takes vitals; doctor begins encounter; SOAP note recorded; prescriptions sent.
7. Encounter signed → invoice generated → copay collected at checkout → receipt emailed.
8. Insurance claim drafted, submitted, tracked. Patient statement issued for balance.
9. Follow-up appointment booked; reminder cycle begins.

### 10.2 Daily Doctor Workflow

1. Login (MFA) → Dashboard shows today's schedule, unsigned notes, urgent messages.
2. Click first Checked-In patient → Encounter Note Editor opens with vitals pre-filled.
3. Use template, dictate or type, search ICD-10, prescribe medication, sign note.
4. Status auto-updates to Completed; next patient queued.
5. End of day: review unsigned notes queue; sign or delegate addenda.

### 10.3 Front Desk Daily Workflow

1. Login → Today's Roster screen.
2. Check in arriving patients; update insurance if needed; collect copays.
3. Field walk-ins: check schedule, book or add to waitlist.
4. Process check-outs: confirm next appointment, take payment, print/email receipt.
5. Throughout day: answer portal messages routed from triage.

### 10.4 Patient Self-Service Journey

1. Patient logs into portal → Dashboard shows next appointment, balance, new lab.
2. Books a follow-up by selecting provider, date, time, reason.
3. Reviews lab results released by doctor with attached note.
4. Pays outstanding balance with saved card; receipt emailed.
5. Messages clinical staff with a non-urgent question; receives response within practice's stated SLA.

---

## 11. Risks, Assumptions, and Open Questions

### 11.1 Assumptions

- Practices will operate the system with a stable broadband internet connection.
- Initial deployment is single-region; additional regions handled in a later phase.
- No requirement to support legacy data migration tooling at launch (handled as professional service).
- Compliance and regulatory requirements (HIPAA, GDPR, etc.) will be defined in a separate workstream and incorporated before launch.

### 11.2 Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Data breach | High | Severe — loss of patient trust and reputation damage. | Defense in depth: encryption, MFA, audit logs, regular security review, penetration testing. |
| Scope creep into full EHR | High | Delays launch; dilutes focus. | Hold the line on v1.0 scope; maintain explicit roadmap for v1.5 / v2.0. |
| Adoption resistance | Medium | Practices revert to legacy tools. | Emphasize speed and keyboard workflows; provide white-glove onboarding. |
| Regulatory complexity (deferred) | Medium | Compliance work added late may require rework. | Tag fields and flows likely to be regulated; plan a dedicated compliance pass before launch. |
| Payment processor downtime | Medium | Cannot collect payments. | Graceful degradation: queue payments and allow offline cash/check capture. |
| Calendar concurrency conflicts | Low | Double-booking. | Optimistic locking; clear UI affordance for conflicts. |

### 11.3 Open Questions for Stakeholders

- Will the practice want a self-check-in kiosk experience at launch, or only at the front desk?
- Should patient portal allow new-patient self-registration, or only existing patients (invite-only)?
- Will there be a need for multi-language support at launch (Spanish in particular for U.S. deployments)?
- How are cancellation fees handled — automatic charge to card on file, or manual invoice?
- Should clinical templates be shareable across practices, or strictly per-practice?

---

## 12. Technology Stack and Architecture

This section documents the chosen implementation stack so designers, engineers, and stakeholders share a consistent picture of how the system will be built. The choices here shape several decisions in earlier sections — particularly the design system (Section 7) and the data model (Section 9).

### 12.1 Stack Summary

| Layer | Choice | Notes |
| --- | --- | --- |
| Monorepo | Nx workspace | Single repository hosting all frontend, backend, and shared libraries with consistent tooling, linting, and dependency graph. |
| Frontend framework | Angular (latest LTS) | Used for both the staff app and the patient portal as separate Nx applications. |
| UI component library | Angular Material | Material 3 theming. All UI built from Material primitives unless an explicit gap exists. |
| Frontend architecture | Domain-Driven Design (DDD) | Code organized by bounded context (patient, scheduling, billing, etc.) rather than by technical layer. |
| State management | NgRx (or Angular Signals + RxJS where lighter-weight is sufficient) | Per-domain feature stores; shared selectors live in domain libraries. |
| Backend framework | NestJS | Modular architecture aligns naturally with DDD bounded contexts. |
| Database | PostgreSQL | Primary system of record. JSONB used for flexible clinical fields where appropriate. |
| ORM / data layer | Prisma or TypeORM | TypeORM is conventional with NestJS; Prisma offers stronger type safety. Choice deferred to engineering. |
| API style | REST (OpenAPI-documented) | GraphQL may be considered for v2.0 if patient portal data needs flatten poorly into REST. |
| Authentication | JWT (access + refresh) with MFA via TOTP | Sessions stored in Redis. |
| File storage | AWS S3 (encrypted) | For patient documents and uploads. |
| Background jobs | BullMQ on Redis | Notifications, report generation, scheduled reminders. |
| Containerization | Docker | Per-app images built via Nx targets. |
| CI/CD | GitHub Actions or GitLab CI | Affected-only builds via Nx graph. |

### 12.2 Nx Monorepo Layout

The Nx workspace is organized to enforce DDD boundaries. Apps are thin shells; the bulk of the code lives in domain libraries that can be independently tested, refactored, and (eventually) extracted.

Suggested high-level structure:

| Path | Contents |
| --- | --- |
| `apps/staff-web` | Angular app — staff and clinician interface. |
| `apps/patient-portal` | Angular app — patient-facing portal. |
| `apps/api` | NestJS app — primary backend API. |
| `apps/worker` | NestJS app — background job processor (BullMQ consumers). |
| `libs/<domain>/feature-*` | Smart components, routes, page-level state for a domain. |
| `libs/<domain>/ui` | Dumb / presentational components for a domain. |
| `libs/<domain>/data-access` | API clients, NgRx state, selectors, effects for a domain. |
| `libs/<domain>/domain` | Pure domain models, types, value objects, validation. Framework-free. |
| `libs/<domain>/util` | Domain-specific helpers, formatters. |
| `libs/shared/ui` | Cross-domain UI primitives (Material wrappers, layout shell). |
| `libs/shared/util` | Cross-cutting utilities, date helpers, formatters. |
| `libs/shared/auth` | Authentication, guards, interceptors. |
| `libs/api/<domain>` | NestJS modules per bounded context — controllers, services, repositories, domain entities. |
| `libs/api/shared` | Cross-cutting backend concerns (logging, tracing, error filters). |

**Nx module boundary rules** (enforced via ESLint):

- `feature` libraries may depend on `ui`, `data-access`, `domain`, `util` — never on other features.
- `ui` libraries may depend on `domain` and `util` — never on `data-access` or `feature`.
- `data-access` libraries may depend on `domain` and `util` — never on `ui` or `feature`.
- `domain` libraries depend on nothing except `util` — they are the pure core.
- Cross-domain dependencies are forbidden by default. Sharing happens via `libs/shared/*` or via explicit, reviewed exceptions.

### 12.3 Bounded Contexts

Each bounded context corresponds to one functional module from Section 4 and gets its own set of libraries on both the frontend and backend. These are the contexts for v1.0:

| Bounded Context | Owns |
| --- | --- |
| patient | Patient profiles, demographics, documents, alerts. |
| scheduling | Appointments, calendars, waitlists, recurring series. |
| staff | Doctors, nurses, support staff, schedules, credentials. |
| clinical | Encounters, SOAP notes, vitals, prescriptions, diagnoses. |
| billing | Invoices, payments, fee schedules, claims, statements. |
| notifications | Email, SMS, in-app, portal messages. |
| reporting | Dashboards, standard reports, exports. |
| portal | Patient portal–specific orchestration over the other contexts. |
| identity | Users, roles, permissions, authentication, audit log. |

On the backend, each bounded context is a NestJS module with its own controllers, services, repositories, and entity definitions. Cross-context communication happens through application services or domain events, not direct repository access.

### 12.4 Component Mapping: Section 7.3 → Angular Material

This table tells the design team which Angular Material component each item in Section 7.3 maps to. Reference these component names directly in Stitch prompts, and ensure exported designs reflect these primitives — same variants, same states — so handoff to Angular Material implementation is mechanical.

| Section 7.3 Component | Angular Material Equivalent |
| --- | --- |
| Buttons | `MatButton` (with variants: basic, raised, stroked, flat, fab, mini-fab, icon) |
| Text inputs | `MatFormField` + `MatInput`, with appearance: outline (preferred for clinical density) |
| Date / time pickers | `MatDatepicker`, `MatTimepicker` (Material 19+ or custom) |
| Select / multi-select | `MatSelect`, with chip-based multi-select via `MatChipGrid` |
| Search-with-results | `MatAutocomplete` (used for patient search, ICD-10, drug search) |
| Tables | `MatTable` with `MatSort`, `MatPaginator`; CDK virtual scroll for long lists |
| Cards | `MatCard` (custom variants for patient summary, appointment, invoice) |
| Modals | `MatDialog` |
| Side panels (slide-over) | `MatSidenav` configured as overlay, or `MatBottomSheet` on mobile |
| Toasts | `MatSnackBar` |
| Inline alerts | Custom component (Material lacks a first-class alert) — built on `MatCard` with semantic theming |
| Tabs | `MatTabs` |
| Accordion | `MatExpansionPanel` |
| Tooltips | `MatTooltip` |
| Status badges | `MatChip` with semantic color tokens |
| Avatar | Custom component — Material has no avatar primitive. Use `MatIcon` for fallback initials styling. |
| Calendar | Custom — Material's date picker is not a scheduling calendar. Recommend Angular Calendar (mattlewis92/angular-calendar) or a fully custom build using CDK primitives. |
| Skeleton loaders | Custom — built on top of CDK and Angular Material's theming tokens. |
| Empty states | Custom — illustration + heading + action; no Material primitive. |

The custom-build items above are the ones to flag early — they need design effort that goes beyond restyling a Material primitive.

### 12.5 DDD Implementation Notes

Domain-Driven Design here is not just folder structure. The expectations:

- Domain libraries (`libs/<domain>/domain` on the frontend; `libs/api/<domain>/domain` on the backend) contain entities, value objects, aggregates, and domain services. They have zero framework imports — no Angular, no NestJS, no HTTP, no database.
- Aggregates have explicit roots. For example, `Patient` is an aggregate root that owns `InsurancePolicy`, `Allergy`, `EmergencyContact`. External code modifies these only through the `Patient` root.
- Repositories are interfaces in the domain layer; their concrete implementations live in the data-access layer (frontend) or infrastructure layer (backend).
- Use ubiquitous language consistently — the same terms the glossary in Section 1.5 defines should appear in code, types, and database table names.
- Domain events (e.g., `AppointmentCheckedIn`, `EncounterSigned`, `InvoicePaid`) are first-class. They drive notifications, audit logging, and cross-context reactions without coupling contexts.

### 12.6 What This Means for Design

The stack choice has a few practical implications for the design team:

- **Material 3 is the visual baseline.** Don't fight it. Customize tokens (color, typography, density) extensively, but keep component structure recognizable. A custom-looking Material app is fine; a Material app that pretends to be Tailwind is painful.
- **Density matters.** Material's default density is too airy for clinical density. Plan to adopt Material's high-density variants (–1 or –2) for tables, forms, and lists in the staff app. The patient portal can stay at default density.
- **Two apps, two moods, one system.** Both the staff app and patient portal share the same design system, the same tokens, and the same Angular Material setup — but with different density, spacing, and tone (see Section 7.1).
- **Custom components should be flagged explicitly.** Tag any component that does not map to a Material primitive (per Section 12.4) so engineering can scope custom build effort accurately.

---

## 13. Release Roadmap

| Release | Scope |
| --- | --- |
| v1.0 (MVP) | Patient profiles, scheduling, encounters & SOAP notes, billing & payments, patient portal, notifications, core reports, RBAC, audit logging. |
| v1.5 | e-Prescribing (Surescripts), insurance eligibility verification, custom report builder, SSO, advanced templates. |
| v2.0 | Telehealth video, lab results integration (HL7/FHIR), native mobile apps (staff and patient), kiosk check-in. |
| v2.5+ | AI-assisted note drafting, claims clearinghouse integration, multi-location consolidated reporting, advanced inventory. |

---

## 14. Design Handoff Checklist

Before screen design begins, the design team should confirm the following with the product owner:

- All glossary terms understood and confirmed.
- Permissions matrix reviewed with a representative from each user role.
- Brand identity (logo, primary color, voice) provided or commissioned.
- Sample real-world data provided for content design (patient names, appointment types, fee schedule).
- Decision recorded for each Open Question in section 11.3.
- Accessibility target confirmed (WCAG 2.2 AA).
- Browser/device support confirmed.

Design deliverables expected back from the design team:

- Stitch project with the design system description, reference assets, and prompt library used to generate the screens.
- Foundations: color, typography, spacing, elevation, iconography tokens — documented as a Material 3 theme specification.
- All screens listed in Section 4 (per module) at desktop and tablet breakpoints, generated in Stitch and exported to Figma for refinement and component organization.
- Patient portal screens at desktop and mobile breakpoints.
- Component inventory in the exported Figma file, with each component tagged to its Angular Material equivalent (per Section 12.4) or marked as a custom build.
- Interactive prototypes for the four user journeys in Section 10 (Stitch's interactive preview, or built in Figma after export).
- Accessibility annotations on all key flows.
- Empty, loading, and error states for every primary screen.
- Code export from Stitch (HTML/CSS) for reference, even though Angular Material implementation will be the source of truth.

---

*— End of Document —*
