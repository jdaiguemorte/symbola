// Lot 44 (CRM-01 ; D1 à D6, RGP-03 ; ADR 0084) — le formulaire de contact public d'une organisation,
// en page ou encadré dans le site de la planner (même contenu, sans en-tête dans le cadre). Une adresse
// inconnue, ancienne, un formulaire fermé ou sans politique de confidentialité : la même page
// « introuvable ». Aucun compte, aucun cookie autre que celui de la langue.
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { resolvePublicContactForm, sealFormOpening } from "@/modules/events/service";
import { ContactForm } from "./contact-form";

export async function ContactPage({ slug, framed }: { slug: string; framed: boolean }) {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const form = await resolvePublicContactForm(slug, locale);
  if (!form) notFound();
  const t = await getTranslations("ContactForm.public");
  return (
    <main className={framed ? "contact-page contact-page-framed" : "link-page contact-page"}>
      <h1>{t("title", { organization: form.organizationName })}</h1>
      <p className="meta">{t("intro")}</p>
      <ContactForm
        slug={form.slug}
        opened={sealFormOpening(form)}
        hiddenFields={form.hiddenFields}
        eventTypes={form.eventTypes}
        sources={form.sources}
        notice={form.notice}
        privacyPolicyUrl={form.privacyPolicyUrl}
        organizationName={form.organizationName}
      />
    </main>
  );
}
