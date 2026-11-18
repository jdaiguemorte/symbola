// Lot 46 (RDV-03 ; D5, D10 ; ADR 0082) — les e-mails d'un rendez-vous. À la personne : modèles de
// l'organisation (confirmation avec l'invitation .ics, rappel, report, annulation), par la file des
// tâches avec une clé d'unicité (un e-mail rejoué ne part qu'une fois, ADR 0076). À la personne qui
// reçoit : un e-mail de Symbola (nouveau rendez-vous, report, annulation par la personne), dans sa
// langue. Jamais d'e-mail pour un rendez-vous d'essai. Aucune donnée personnelle dans les clés ni
// dans les journaux : des identifiants.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { formatDateTime } from "@symbola/i18n";
import { buildIcs } from "@/lib/calendar/ics";
import { getDocumentHeader, getUserContact, sendOrganizationEmail, sendSymbolaEmail } from "@/modules/hub/service";
import type { AppointmentRow } from "./repository";

type Locale = "fr" | "en";
export type PersonEmailKind = "appointment_confirmed" | "appointment_reminder" | "appointment_rescheduled" | "appointment_cancelled";
export type HostNotice = "booked" | "rescheduled" | "cancelled";

function translator(locale: Locale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Appointments.emails" });
}

export function appUrl(): string {
  return parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");
}

// Le lien de gestion : le jeton après « # », jamais envoyé au serveur dans l'adresse (ADR 0053).
export function manageUrl(token: string): string {
  return `${appUrl()}/rdv#${token}`;
}

export function firstNameOf(personName: string): string {
  return personName.trim().split(/\s+/)[0] ?? personName;
}

// Le lieu, dit en mots, toujours renseigné (un modèle n'emploie que des variables toujours remplies).
export function placeWords(row: Pick<AppointmentRow, "locationKind" | "location">, locale: Locale): string {
  const t = translator(locale);
  if (row.locationKind === "video") return row.location ? t("place.videoLink", { link: row.location }) : t("place.video");
  if (row.locationKind === "phone") return row.location ? t("place.phoneNumber", { phone: row.location }) : t("place.phone");
  return row.location ?? t("place.toBeConfirmed");
}

export function invitationIcs(row: AppointmentRow, organizationName: string, now: Date): Buffer {
  const ics = buildIcs({
    name: organizationName,
    now,
    events: [
      {
        uid: `${row.id}@symbola`,
        summary: `${row.typeName} — ${organizationName}`,
        start: { dateTime: row.startsAt },
        end: { dateTime: row.endsAt },
        location: row.locationKind === "place" ? row.location : null,
        url: row.locationKind === "video" && row.location?.startsWith("https://") ? row.location : null,
        status: "CONFIRMED",
      },
    ],
  });
  return Buffer.from(ics, "utf8");
}

// Clé d'unicité : le rendez-vous, la nature et l'instant du rendez-vous (un report change la clé ;
// un rappel ou une confirmation rejoués ne repartent pas).
export function emailKey(row: Pick<AppointmentRow, "id" | "startsAt">, kind: string): string {
  return `appointment:${row.id}:${kind}:${row.startsAt.getTime()}`;
}

export async function sendPersonEmail(row: AppointmentRow, kind: PersonEmailKind, options: { manageToken?: string | null; keySuffix?: string; now?: Date } = {}): Promise<boolean> {
  if (row.isDemo || !row.personEmail) return false;
  const locale = row.locale;
  const organization = (await getDocumentHeader(appDatabase(), row.organizationId))?.organizationName ?? "";
  const link = options.manageToken ? manageUrl(options.manageToken) : undefined;
  const withInvitation = kind === "appointment_confirmed" || kind === "appointment_rescheduled";
  await sendOrganizationEmail({
    organizationId: row.organizationId,
    to: row.personEmail,
    kind,
    locale,
    values: {
      first_name: firstNameOf(row.personName),
      appointment: row.typeName,
      appointment_date: formatDateTime(row.startsAt, locale),
      place: placeWords(row, locale),
      ...(link ? { link } : {}),
    },
    attachments: withInvitation ? [{ filename: "invitation.ics", content: invitationIcs(row, organization, options.now ?? new Date()), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }] : [],
    idempotencyKey: emailKey(row, `${kind}${options.keySuffix ?? ""}`),
  });
  return true;
}

// À la personne qui reçoit : ce qui vient de se passer, avec le lien vers la fiche.
export async function notifyHost(row: AppointmentRow, notice: HostNotice): Promise<void> {
  if (row.isDemo) return;
  const host = await getUserContact(appDatabase(), row.organizationId, row.hostUserId);
  if (!host) return;
  const t = translator(host.language);
  const values = { type: row.typeName, name: row.personName, date: formatDateTime(row.startsAt, host.language) };
  const url = `${appUrl()}/rendez-vous/${row.id}`;
  await sendSymbolaEmail({
    to: host.email,
    locale: host.language,
    subject: t(`host.${notice}.subject`, values),
    body: `${t(`host.${notice}.body`, values)}\n\n${url}`,
    button: { label: t("host.open"), url },
    organizationId: row.organizationId,
    idempotencyKey: emailKey(row, `host_${notice}`),
  });
}
