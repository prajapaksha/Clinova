import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EMPTY, Observable, Subject, catchError, debounceTime, distinctUntilChanged, filter, finalize,
  forkJoin, map, merge, of, switchMap, tap,
} from 'rxjs';
import type {
  Encounter, EncounterDiagnosis, EncounterId, EncounterTemplate, ICD10Code, Prescription, SoapNote,
} from '@clinova/clinical/domain';
import {
  EncounterStatus, PrescriptionStatus, VitalType, computeBmi, isEncounterEditable,
  recordToVitals, signingBlockers, vitalsToRecord, type VitalsRecord,
} from '@clinova/clinical/domain';
import { ClinicalApiService, type SoapNotePatch } from '@clinova/clinical/data-access';
import type { Patient, PatientId } from '@clinova/patient/domain';
import { PatientApiService } from '@clinova/patient/data-access';
import { Permissions } from '@clinova/auth';
import { EncounterContextComponent } from '../encounter-context/encounter-context.component';
import { PrescriptionDialog, type PrescriptionDialogData } from '../prescription-dialog/prescription-dialog.component';
import { AddendumDialog } from '../addendum-dialog/addendum-dialog.component';
import { ConfirmDialog, type ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { errorMessage } from '../error-message';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 1200;

export const COMMON_LAB_ORDERS = [
  'CBC with differential',
  'Comprehensive metabolic panel (CMP)',
  'Basic metabolic panel (BMP)',
  'Hemoglobin A1c',
  'Lipid panel',
  'TSH',
  'Urinalysis',
  'Vitamin D, 25-hydroxy',
];

const numberControl = () => new FormControl<number | null>(null);
const textControl = () => new FormControl('', { nonNullable: true });

function createEncounterForm() {
  return new FormGroup({
    subjective: new FormGroup({
      chiefComplaint: textControl(),
      historyOfPresentIllness: textControl(),
      reviewOfSystems: textControl(),
    }),
    objective: new FormGroup({
      physicalExamFindings: textControl(),
      relevantResults: textControl(),
    }),
    assessment: new FormGroup({
      clinicalReasoning: textControl(),
    }),
    plan: new FormGroup({
      treatmentPlan: textControl(),
      patientInstructions: textControl(),
      followUpInstructions: textControl(),
      ordersNotes: textControl(),
    }),
    vitals: new FormGroup({
      [VitalType.BloodPressureSystolic]: numberControl(),
      [VitalType.BloodPressureDiastolic]: numberControl(),
      [VitalType.HeartRate]: numberControl(),
      [VitalType.Temperature]: numberControl(),
      [VitalType.RespiratoryRate]: numberControl(),
      [VitalType.OxygenSaturation]: numberControl(),
      [VitalType.WeightKg]: numberControl(),
      [VitalType.HeightCm]: numberControl(),
      [VitalType.PainScale]: numberControl(),
    }),
  });
}

type EncounterFormValue = ReturnType<ReturnType<typeof createEncounterForm>['getRawValue']>;
type PartialFormValue = { [K in keyof EncounterFormValue]?: Partial<EncounterFormValue[K]> };

@Component({
  selector: 'clv-encounter-editor',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, RouterModule, EncounterContextComponent,
    MatAutocompleteModule, MatButtonModule, MatChipsModule, MatExpansionModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatMenuModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './encounter-editor.component.html',
  styleUrl: './encounter-editor.component.scss',
})
export class EncounterEditorComponent {
  private readonly api = inject(ClinicalApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly perms = inject(Permissions);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly VitalType = VitalType;
  protected readonly labOrders = COMMON_LAB_ORDERS;

  protected readonly encounter = signal<Encounter | null>(null);
  protected readonly patient = signal<Patient | null>(null);
  protected readonly history = signal<Encounter[]>([]);
  protected readonly templates = signal<EncounterTemplate[]>([]);
  protected readonly diagnoses = signal<EncounterDiagnosis[]>([]);
  protected readonly icd10Results = signal<ICD10Code[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly lastSavedAt = signal<Date | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = createEncounterForm();
  protected readonly icd10Query = new FormControl<string | ICD10Code>('', { nonNullable: true });

  private readonly diagnosesEdited$ = new Subject<void>();
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private patching = false;

  /** Not yet signed. */
  protected readonly isOpen = computed(() => {
    const enc = this.encounter();
    return !!enc && isEncounterEditable(enc.status);
  });
  /** Open and the user may document (practice admins have read-only access to notes). */
  protected readonly editable = computed(() => this.isOpen() && this.perms.can('clinical:notes', 'write'));
  protected readonly isPhysician = this.perms.isProvider;
  protected readonly blockers = computed(() => signingBlockers(this.buildNote(this.formValue(), this.diagnoses())));
  protected readonly bmi = computed(() => {
    const v = this.formValue().vitals ?? {};
    return computeBmi(v[VitalType.WeightKg], v[VitalType.HeightCm]);
  });

  constructor() {
    toObservable(this.id).pipe(
      tap(() => { this.loading.set(true); this.loadError.set(null); }),
      switchMap(id => this.api.findById(id as EncounterId).pipe(
        switchMap(enc => forkJoin({
          enc: of(enc),
          patient: this.patientApi.findById(enc.patientId as PatientId),
          history: this.api.getEncounters({ patientId: enc.patientId, limit: 10 }).pipe(
            map(r => r.encounters), catchError(() => of([] as Encounter[]))),
          templates: this.api.getTemplates().pipe(catchError(() => of([] as EncounterTemplate[]))),
        })),
        catchError(err => {
          this.loadError.set(errorMessage(err, 'This encounter could not be loaded.'));
          this.loading.set(false);
          return EMPTY;
        }),
      )),
      takeUntilDestroyed(),
    ).subscribe(({ enc, patient, history, templates }) => {
      this.patient.set(patient);
      this.history.set(history);
      this.templates.set(templates);
      this.applyEncounter(enc);
      this.loading.set(false);
    });

    // Autosave: any form or diagnosis change, debounced, while the note is editable.
    merge(this.form.valueChanges, this.diagnosesEdited$).pipe(
      filter(() => !this.patching && this.editable()),
      tap(() => this.saveState.set('pending')),
      debounceTime(AUTOSAVE_DEBOUNCE_MS),
      switchMap(() => this.save().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(),
    ).subscribe();

    this.icd10Query.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => (q.length ? this.api.searchIcd10(q).pipe(catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(),
    ).subscribe(results => this.icd10Results.set(results));

    effect(() => {
      if (this.editable()) {
        this.form.enable({ emitEvent: false });
        this.icd10Query.enable({ emitEvent: false });
      } else {
        this.form.disable({ emitEvent: false });
        this.icd10Query.disable({ emitEvent: false });
      }
    });

    // Flush unsaved edits when navigating away.
    this.destroyRef.onDestroy(() => {
      if (this.saveState() === 'pending' && this.editable()) this.save().subscribe({ error: () => undefined });
    });
  }

  // ── Note editing ──────────────────────────────────────────────────────────

  protected selectDiagnosis(event: MatAutocompleteSelectedEvent): void {
    const code = event.option.value as ICD10Code;
    this.icd10Query.setValue('');
    if (this.diagnoses().some(d => d.code.code === code.code)) return;
    this.diagnoses.update(list => [...list, { code, isPrimary: list.length === 0, notes: null }]);
    this.diagnosesEdited$.next();
  }

  protected setPrimary(code: string): void {
    this.diagnoses.update(list => list.map(d => ({ ...d, isPrimary: d.code.code === code })));
    this.diagnosesEdited$.next();
  }

  protected removeDiagnosis(code: string): void {
    this.diagnoses.update(list => {
      const remaining = list.filter(d => d.code.code !== code);
      if (remaining.length && !remaining.some(d => d.isPrimary)) remaining[0] = { ...remaining[0], isPrimary: true };
      return remaining;
    });
    this.diagnosesEdited$.next();
  }

  protected displayIcd10(value: ICD10Code | string | null): string {
    return typeof value === 'string' ? value : '';
  }

  /** Fills empty fields from the template without overwriting anything already written. */
  protected applyTemplate(template: EncounterTemplate): void {
    const sections = ['subjective', 'objective', 'plan'] as const;
    let filled = 0;
    for (const section of sections) {
      const defaults = (template.defaultNote[section] ?? {}) as Record<string, string | null>;
      const group = this.form.controls[section] as FormGroup;
      for (const [field, value] of Object.entries(defaults)) {
        const control = group.get(field);
        if (control && value && !String(control.value ?? '').trim()) {
          control.setValue(value);
          filled++;
        }
      }
    }
    this.snack.open(
      filled
        ? `${template.name} template applied to ${filled} empty field${filled > 1 ? 's' : ''}.`
        : 'All template fields already have content.',
      undefined,
      { duration: 3000 },
    );
  }

  protected addLabOrder(lab: string): void {
    const control = this.form.controls.plan.controls.ordersNotes;
    const current = control.value.trim();
    if (current.split('\n').some(line => line.trim() === lab)) return;
    control.setValue(current ? `${current}\n${lab}` : lab);
  }

  // ── Prescriptions & addenda ───────────────────────────────────────────────

  protected openPrescriptionDialog(): void {
    const enc = this.encounter();
    const patient = this.patient();
    if (!enc || !patient) return;
    const data: PrescriptionDialogData = {
      encounterId: enc.id,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
    };
    this.dialog.open(PrescriptionDialog, { data, width: '680px', autoFocus: 'first-tabbable' })
      .afterClosed()
      .pipe(filter((rx): rx is Prescription => !!rx), switchMap(() => this.api.findById(enc.id)))
      .subscribe(updated => {
        this.encounter.set(updated);
        this.snack.open('Prescription added.', undefined, { duration: 3000 });
      });
  }

  protected discontinuePrescription(rx: Prescription): void {
    this.api.updatePrescription(rx.id, { status: PrescriptionStatus.Discontinued }).pipe(
      switchMap(() => this.api.findById(rx.encounterId)),
    ).subscribe({
      next: updated => this.encounter.set(updated),
      error: err => this.snack.open(errorMessage(err), 'Dismiss'),
    });
  }

  protected openAddendumDialog(): void {
    const enc = this.encounter();
    if (!enc) return;
    this.dialog.open(AddendumDialog, { width: '560px' }).afterClosed().pipe(
      filter((content): content is string => !!content),
      switchMap(content => this.api.addAddendum(enc.id, content)),
    ).subscribe({
      next: updated => {
        this.encounter.set(updated);
        this.snack.open('Addendum added.', undefined, { duration: 3000 });
      },
      error: err => this.snack.open(errorMessage(err), 'Dismiss'),
    });
  }

  // ── Lifecycle actions ─────────────────────────────────────────────────────

  protected saveDraft(): void {
    this.runAction(this.save('DRAFT'), () => {
      this.snack.open('Draft saved.', undefined, { duration: 3000 });
      this.router.navigate(['/encounters']);
    });
  }

  protected sign(): void {
    const enc = this.encounter();
    if (!enc || this.blockers().length) return;
    this.runAction(this.save().pipe(switchMap(() => this.api.sign(enc.id))), signed => {
      this.applyEncounter(signed);
      this.snack.open('Note signed and locked.', undefined, { duration: 4000 });
    });
  }

  protected discard(): void {
    const enc = this.encounter();
    if (!enc) return;
    const rxCount = enc.prescriptions.length;
    const data: ConfirmDialogData = {
      title: 'Discard this encounter?',
      message:
        'The note will be permanently deleted' +
        (rxCount ? ` along with ${rxCount} prescription${rxCount > 1 ? 's' : ''}` : '') +
        (enc.appointmentId ? '. The appointment will return to Checked In.' : '.'),
      confirmLabel: 'Discard',
      destructive: true,
    };
    this.dialog.open(ConfirmDialog, { data, width: '440px' }).afterClosed().pipe(filter(Boolean)).subscribe(() => {
      this.saveState.set('idle');
      this.runAction(this.api.discard(enc.id), () => {
        this.snack.open('Encounter discarded.', undefined, { duration: 3000 });
        this.router.navigate(['/patients', enc.patientId, 'notes']);
      });
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private runAction<T>(action$: Observable<T>, onSuccess: (result: T) => void): void {
    this.busy.set(true);
    action$.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: onSuccess,
      error: err => this.snack.open(errorMessage(err), 'Dismiss'),
    });
  }

  private save(status?: 'DRAFT' | 'IN_PROGRESS'): Observable<Encounter> {
    const enc = this.encounter();
    if (!enc || !this.editable()) return EMPTY;
    const raw = this.form.getRawValue();
    this.saveState.set('saving');
    return this.api.updateNote(enc.id, {
      note: this.buildNote(raw, this.diagnoses()) as SoapNotePatch,
      vitals: recordToVitals(raw.vitals as VitalsRecord),
      ...(status ? { status } : {}),
    }).pipe(
      tap(updated => {
        this.encounter.set(updated);
        this.lastSavedAt.set(new Date());
        // Stay "pending" if the user kept typing while the request was in flight.
        if (this.saveState() === 'saving') this.saveState.set('saved');
      }),
      catchError(err => {
        this.saveState.set('error');
        throw err;
      }),
    );
  }

  private buildNote(raw: PartialFormValue, diagnoses: EncounterDiagnosis[]): SoapNote {
    const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);
    return {
      subjective: {
        chiefComplaint: raw.subjective?.chiefComplaint ?? '',
        historyOfPresentIllness: raw.subjective?.historyOfPresentIllness ?? '',
        reviewOfSystems: blankToNull(raw.subjective?.reviewOfSystems),
      },
      objective: {
        physicalExamFindings: blankToNull(raw.objective?.physicalExamFindings),
        relevantResults: blankToNull(raw.objective?.relevantResults),
      },
      assessment: {
        diagnoses,
        clinicalReasoning: blankToNull(raw.assessment?.clinicalReasoning),
      },
      plan: {
        treatmentPlan: raw.plan?.treatmentPlan ?? '',
        patientInstructions: blankToNull(raw.plan?.patientInstructions),
        followUpInstructions: blankToNull(raw.plan?.followUpInstructions),
        ordersNotes: blankToNull(raw.plan?.ordersNotes),
      },
    };
  }

  private applyEncounter(enc: Encounter): void {
    this.encounter.set(enc);
    this.patching = true;
    const n = enc.note;
    this.form.patchValue({
      subjective: {
        chiefComplaint: n.subjective.chiefComplaint,
        historyOfPresentIllness: n.subjective.historyOfPresentIllness,
        reviewOfSystems: n.subjective.reviewOfSystems ?? '',
      },
      objective: {
        physicalExamFindings: n.objective.physicalExamFindings ?? '',
        relevantResults: n.objective.relevantResults ?? '',
      },
      assessment: { clinicalReasoning: n.assessment.clinicalReasoning ?? '' },
      plan: {
        treatmentPlan: n.plan.treatmentPlan,
        patientInstructions: n.plan.patientInstructions ?? '',
        followUpInstructions: n.plan.followUpInstructions ?? '',
        ordersNotes: n.plan.ordersNotes ?? '',
      },
      vitals: vitalsToRecord(enc.vitals),
    });
    this.diagnoses.set([...n.assessment.diagnoses]);
    this.patching = false;
    if (!isEncounterEditable(enc.status)) this.saveState.set('idle');
  }

  protected readonly EncounterStatus = EncounterStatus;
}
