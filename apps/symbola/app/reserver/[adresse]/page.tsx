import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import type { Locale } from "@symbola/i18n";
import { getOrganizationContact } from "@/modules/hub/service";
import { APPOINTMENTS_TIME_ZONE, availableSlots, resolvePublicBookingPage } from "@/modules/appointments/service";
import { BookingWizard } from "./booking-wizard";

function zonedDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APPOINTMENTS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

// Lot 46 (RDV-02, RDV-03 ; D5, D11 ; ADR 0082) — la page publique de réservation d'une organisation
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

  // Lot 64 (maquettes M8 à M10) : une fenêtre, le mois et les heures du jour choisi, puis une étape à
  // la fois. Tous les créneaux de l'horizon partent au navigateur (heures seulement, rien de personnel).
  return (
    <main className="link-page booking-page">
      <BookingWizard
        slug={page.slug}
        type={{ id: type.id, name: type.name, durationMinutes: type.durationMinutes, locationKind: type.locationKind, description: type.description, questions: type.questions }}
        slots={slots.map((slot) => slot.toISOString())}
        locale={locale}
        organizationName={organization.name}
        today={zonedDate(now)}
        otherTypesHref={page.types.length > 1 ? `/reserver/${page.slug}` : null}
      />
      <details className="booking-notice">
        <summary>{t("privacySummary", { organization: organization.name })}</summary>
        <p>{page.privacyNotice}</p>
      </details>
    </main>
  );
}
