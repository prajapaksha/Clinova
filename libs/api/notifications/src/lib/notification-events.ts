/** Domain events that trigger patient or staff notifications (published by the API). */
export type AppointmentEventType =
  | 'scheduling.AppointmentBooked'
  | 'scheduling.AppointmentRescheduled'
  | 'scheduling.AppointmentCancelled'
  | 'scheduling.AppointmentNoShow';

export interface AppointmentEvent {
  readonly type: AppointmentEventType;
  readonly appointmentId: string;
  readonly timestamp: Date;
}

export interface InvoiceIssuedEvent {
  readonly type: 'billing.InvoiceIssued';
  readonly invoiceId: string;
  readonly patientId: string;
  readonly timestamp: Date;
}

/** Published by InvoicesService on every payment. */
export interface PaymentReceivedEvent {
  readonly type: 'billing.PaymentReceived';
  readonly paymentId: string;
  readonly patientId: string;
  readonly amountCents: number;
  readonly method: string;
  readonly timestamp: Date;
}

export interface DocumentSharedEvent {
  readonly type: 'patient.DocumentShared';
  readonly patientId: string;
  readonly documentId: string;
  readonly documentName: string;
  readonly isResult: boolean;
  readonly sharedByName: string | null;
  readonly timestamp: Date;
}

export interface RefillRespondedEvent {
  readonly type: 'portal.RefillResponded';
  readonly refillRequestId: string;
  readonly timestamp: Date;
}

export interface RefillRequestedEvent {
  readonly type: 'portal.RefillRequested';
  readonly refillRequestId: string;
  readonly timestamp: Date;
}

export interface CareTeamRepliedEvent {
  readonly type: 'portal.CareTeamReplied';
  readonly threadId: string;
  readonly messageId: string;
  readonly timestamp: Date;
}

export interface PatientMessageSentEvent {
  readonly type: 'portal.PatientMessageSent';
  readonly threadId: string;
  readonly messageId: string;
  readonly timestamp: Date;
}

export interface ProfileChangeEvent {
  readonly type: 'portal.ProfileChangeRequested' | 'portal.ProfileChangeReviewed';
  readonly requestId: string;
  readonly timestamp: Date;
}