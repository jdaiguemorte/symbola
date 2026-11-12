import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getVendorLinkView, LinkAccessDeniedError } from "@/modules/events/service";
import { getOrganizationContact } from "@/modules/hub/service";
import { requireLink } from "@/lib/guards";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { closeLinkSessionAction } from "@/app/portail/actions";
import { LinkPrivacyNotice } from "@/app/portail/link-privacy-notice";

// Lot 26b (UX-11, POR-01 ; ADR 0053, décision D9) — espace minimal d'un
// prestataire, ouvert par son lien personnel, sans compte : l'événement
// (prénoms des clients, date), les lieux, les lignes du programme où figure son
// poste, le contact de l'organisation. Rien d'autre : ni prix, ni budget, ni
// autre prestataire, ni portail du client (SC-S3). L'espace complet et le brief
// viennent au lot 47.
export default async function VendorSpacePage() {
  const access = await requireLink("vendor");
  const { organizationId, linkId } = access;
  const t = await getTranslations("VendorSpace");
  const tLink = await getTranslations("LinkPortal");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  // Dégradation propre (CLAUDE.md § 2.2) : module désactivé = « indisponible ».
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main className="portal">
        <h1>{t("title")}</h1>
        <p>{t("unavailable")}</p>
        <LinkPrivacyNotice organizationId={organizationId} />
      </main>
    );
  }

  let view;
  try {
    view = await getVendorLinkView(organizationId, linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) redirect("/lien");
    throw error;
  }
  const contact = await getOrganizationContact(appDatabase(), organizationId);

  return (
    <main className="portal">
      <p className="muted">{tLink("greeting", { name: access.personName })}</p>
      <h1>{view.clientFirstNames.length > 0 ? view.clientFirstNames.join(" & ") : t("title")}</h1>
      <p>{t("yourRole", { vendor: view.vendorName, slot: view.slotLabel })}</p>
      <ScreenHelp title={tHelp("vendorSpace.title")} body={tHelp("vendorSpace.body")} />
      <p>
        {t("eventDate")} : {view.eventDate ? formatCalendarDate(view.eventDate, locale) : t("dateUnset")}
      </p>

      <h2>{t("placesTitle")}</h2>
      {view.places.length === 0 ? (
        <p>{t("noPlaces")}</p>
      ) : (
        <ul aria-label={t("placesTitle")}>
          {view.places.map((place) => (
            <li key={place.id}>
              <strong>{place.label}</strong>
              {place.address ? ` — ${place.address}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h2>{t("programTitle")}</h2>
      {view.programItems.length === 0 ? (
        <p>{t("noProgramItems")}</p>
      ) : (
        <ul aria-label={t("programTitle")}>
          {view.programItems.map((item) => (
            <li key={item.id}>
              <strong>
                {item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime} — {item.label}
              </strong>
              {item.location ? ` — ${item.location}` : ""}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="vendor-contact-title">
        <h2 id="vendor-contact-title">{t("contactTitle")}</h2>
        <p>{contact.name}</p>
        {contact.email ? (
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        ) : null}
        {contact.phone ? (
          <p>
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
          </p>
        ) : null}
      </section>

      <p className="muted">{tLink("validUntil", { date: formatCalendarDate(access.expiresOn, locale) })}</p>
      <form action={closeLinkSessionAction}>
        <button type="submit">{tLink("closeSession")}</button>
      </form>
      <LinkPrivacyNotice organizationId={organizationId} />
    </main>
  );
}
