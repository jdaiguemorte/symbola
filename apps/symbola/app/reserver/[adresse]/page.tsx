import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { getOrganizationContact } from "@/modules/hub/service";
import { APPOINTMENTS_TIME_ZONE, availableSlots, resolvePublicBookingPage } from "@/modules/appointments/service";
import { BookingForm, type SlotDay } from "./booking-form";

const DAY_MS = 24 * 60 * 60 * 1000;

function zonedDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APPOINTMENTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

// Lot 46 (RDV-02, RDV-03 ; D5, D11 ; ADR 0083) — la page publique de réservation d'une organisation
// (/reserver/<adresse>) : un type, puis une semaine de créneaux libres, puis le formulaire. Aucun
// compte ; aucun cookie autre que celui de la langue ; ni indexée ni citée comme référent. Une
// adresse inconnue, une page fermée ou un module fermé : la même page « introuvable ». Les créneaux
// sont calculés sur les disponibilités réelles (agendas relus s'ils ont plus de quinze minutes).
export default async function BookingPage({ params, searchParams }: { params: Promise<{ adresse: string }>; searchParams: Promise<{ type?: string; semaine?: string }> }) {
  const { adresse } = await params;
  const query = await searchParams;
  const locale = ((await getLocale()) === "en" ? "en" : "fr") as Locale;
  const t = await getTranslations("Appointments.public");
  const page = await resolvePublicBookingPage(adresse, locale);
  if (!page) notFound();
  const organization = await getOrganizationContact(appDatabase(), page.organizationId);
  const type = page.types.length === 1 ? page.types[0]! : page.types.find((candidate) => candidate.id === query.type) ?? null;

  if (!type) {
    return (
      <main className="link-page booking-page">
        <h1>{t("title", { organization: organization.name })}</h1>
        {page.types.length === 0 ? (
          <p>{t("noType")}</p>
        ) : (
          <>
            <p>{t("chooseType")}</p>
            <ul className="booking-types">
              {page.types.map((candidate) => (
                <li key={candidate.id} className="card">
                  <Link href={`/reserver/${page.slug}?type=${candidate.id}`}>
                    <strong>{candidate.name}</strong>
                  </Link>
                  <p className="meta">{t("typeMeta", { minutes: candidate.durationMinutes, place: t(`place.${candidate.locationKind}`) })}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">{page.privacyNotice}</p>
      </main>
    );
  }

  const now = new Date();
  const slots = await availableSlots(page.organizationId, type.id, { now });
  const today = zonedDate(now);
  const start = query.semaine && /^\d{4}-\d{2}-\d{2}$/.test(query.semaine) && query.semaine >= today ? query.semaine : (slots[0] ? zonedDate(slots[0]) : today);
  const startDay = new Date(`${start}T12:00:00Z`);
  const days: SlotDay[] = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(startDay.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
    return { date, slots: slots.filter((slot) => zonedDate(slot) === date).map((slot) => slot.toISOString()) };
  });
  const previous = new Date(startDay.getTime() - 7 * DAY_MS).toISOString().slice(0, 10);
  const next = new Date(startDay.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const hasLater = slots.some((slot) => zonedDate(slot) >= next);
  const base = `/reserver/${page.slug}?type=${type.id}`;

  return (
    <main className="link-page booking-page">
      <p className="muted">{organization.name}</p>
      <h1>{type.name}</h1>
      <p className="meta">{t("typeMeta", { minutes: type.durationMinutes, place: t(`place.${type.locationKind}`) })}</p>
      {page.types.length > 1 ? <Link href={`/reserver/${page.slug}`}>{t("otherTypes")}</Link> : null}
      {slots.length === 0 ? (
        <p role="status">{t("noSlot", { organization: organization.name })}</p>
      ) : (
        <>
          <nav className="row-wrap booking-weeks" aria-label={t("weeksLabel")}>
            {slots[0] && start > zonedDate(slots[0]) ? <Link href={`${base}&semaine=${previous < today ? today : previous}`}>{t("previousWeek")}</Link> : null}
            {hasLater ? <Link href={`${base}&semaine=${next}`}>{t("nextWeek")}</Link> : null}
          </nav>
          <BookingForm
            slug={page.slug}
            typeId={type.id}
            days={days}
            questions={type.questions}
            locale={locale}
            organizationName={organization.name}
          />
        </>
      )}
      <p className="meta">{t("delayNotice")}</p>
      <p className="muted">{page.privacyNotice}</p>
    </main>
  );
}
