// Contrat du module appointments (lot 46 : RDV-01 à RDV-04, EVT-10 ; D1 à D11 ; ADR 0080) : ce que
// son service.ts expose aux écrans et aux autres modules. Pensé comme le futur contrat HTTP
// /v1/appointments si le module devient une app autonome (ADR 0011).

export const APPOINTMENT_LOCATION_KINDS = ["place", "video", "phone"] as const;
export type AppointmentLocationKind = (typeof APPOINTMENT_LOCATION_KINDS)[number];

// D10 : rappels par e-mail, réglés par type.
export const APPOINTMENT_REMINDER_PLANS = ["none", "24h", "24h_2h"] as const;
export type AppointmentReminderPlan = (typeof APPOINTMENT_REMINDER_PLANS)[number];

// RDV-03 : motif d'annulation, facultatif, choisi dans une liste.
export const APPOINTMENT_CANCEL_REASONS = ["schedule", "other_provider", "project_changed", "other"] as const;
export type AppointmentCancelReason = (typeof APPOINTMENT_CANCEL_REASONS)[number];

export const APPOINTMENT_QUESTION_KINDS = ["choice", "text"] as const;
export type AppointmentQuestionKind = (typeof APPOINTMENT_QUESTION_KINDS)[number];
export const APPOINTMENT_QUESTIONS_MAX = 5;

export type AppointmentQuestion = { id: string; label: string; kind: AppointmentQuestionKind; choices: string[] };

export type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  locationKind: AppointmentLocationKind;
  location: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  reminders: AppointmentReminderPlan;
  questions: AppointmentQuestion[];
  hostUserId: string;
  allowEventDays: boolean;
  active: boolean;
  position: number;
};

// RDV-01 : seuls le nom et la durée sont demandés ; le reste a sa valeur par défaut.
export type AppointmentTypeInput = {
  name: string;
  durationMinutes: number;
  locationKind?: AppointmentLocationKind;
  location?: string | null;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minNoticeMinutes?: number;
  horizonDays?: number;
  reminders?: AppointmentReminderPlan;
  questions?: AppointmentQuestion[];
  hostUserId?: string;
  allowEventDays?: boolean;
  active?: boolean;
};

export type AppointmentStatus = "booked" | "cancelled";
export type AppointmentOrigin = "public" | "manual";
export type AppointmentAnswerView = { questionId: string; label: string; answer: string };

export type Appointment = {
  id: string;
  typeId: string | null;
  typeName: string;
  hostUserId: string;
  // Instants ISO (UTC).
  startsAt: string;
  endsAt: string;
  locationKind: AppointmentLocationKind;
  location: string | null;
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  personName: string;
  personEmail: string | null;
  personPhone: string | null;
  locale: "fr" | "en";
  answers: AppointmentAnswerView[];
  contactId: string | null;
  eventId: string | null;
  createdAt: string;
  rescheduledAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "person" | "planner" | null;
  cancelReason: AppointmentCancelReason | null;
  isDemo: boolean;
};

export type AppointmentReportAction = {
  id: string;
  label: string;
  dueOn: string | null;
  responsible: "planner" | "clients";
  taskId: string | null;
  taskEventId: string | null;
};

export type AppointmentReport = {
  id: string;
  appointmentId: string;
  notes: string | null;
  actions: AppointmentReportAction[];
  updatedAt: string;
};

export type BookingPage = { slug: string; active: boolean; privacyNotice: string | null };

export type AvailabilityRule = { weekday: number; startTime: string; endTime: string };
export type AvailabilityClosure = { id: string; startsOn: string; endsOn: string; reason: string | null };

export type CalendarSourceState = "pending" | "ok" | "error";
export type CalendarSourceErrorKind = "blocked" | "too_large" | "timeout" | "http" | "parse";
// L'adresse secrète n'est jamais renvoyée : son hôte et ses quatre derniers caractères seulement.
export type CalendarSourceView = {
  id: string;
  userId: string;
  label: string;
  urlHint: string;
  state: CalendarSourceState;
  failures: number;
  lastErrorKind: CalendarSourceErrorKind | null;
  lastReadAt: string | null;
  lastSuccessAt: string | null;
};

// HUB-08 : ce que l'accueil « Aujourd'hui » montre du module.
export type TodayAppointment = Pick<Appointment, "id" | "typeName" | "personName" | "startsAt" | "endsAt" | "status" | "eventId" | "hostUserId"> & {
  change: "today" | "new" | "rescheduled" | "cancelled";
  changedAt: string | null;
};
