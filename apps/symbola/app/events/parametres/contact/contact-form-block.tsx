// Lot 44 (CRM-01 ; D1 à D3, D7 ; ADR 0084) — Formulaire de contact : ouvrir le formulaire, son adresse,
// les champs facultatifs montrés, l'adresse de la politique de confidentialité (sans elle, le formulaire
// ne s'ouvre pas), les sites autorisés à l'encadrer, l'e-mail de nouvelle demande. Puis le lien à
// partager, le code à copier dans le site et l'aperçu. Réservé à la titulaire (la page qui le montre est
// gardée par requireOwner). Lot 74g : un bloc de la rubrique « Demandes : étapes et formulaire de
// contact » (/events/parametres/etapes#contact), formulaire inchangé.
import { getLocale, getTranslations } from "next-intl/server";
import { parseEnv } from "@symbola/env";
import { appDatabase } from "@symbola/db/client";
import { getContactFormSettings, suggestContactFormSlug } from "@/modules/events/service";
import { getOrganizationContact } from "@/modules/hub/service";
import { ContactSettingsForm } from "./contact-settings-form";

export async function ContactFormBlock({ organizationId }: { organizationId: string }) {
  const t = await getTranslations("ContactForm.settings");
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const settings = await getContactFormSettings(organizationId);
  const slug = settings?.slug ?? (await suggestContactFormSlug((await getOrganizationContact(appDatabase(), organizationId)).name));
  const base = parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");
  const publicUrl = `${base}/contact/${slug}`;
  const frameUrl = `${publicUrl}/cadre`;
  const open = Boolean(settings?.active && settings.privacyPolicyUrl);

  return (
    <>
      <h2 id="contact-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      <p className={open ? "badge badge-sauge" : "badge"}>{open ? t("stateOpen") : t("stateClosed")}</p>
      <ContactSettingsForm
        settings={{
          active: settings?.active ?? false,
          slug,
          hiddenFields: settings?.hiddenFields ?? [],
          privacyPolicyUrl: settings?.privacyPolicyUrl ?? "",
          allowedOrigins: settings?.allowedOrigins ?? [],
          notifyOwner: settings?.notifyOwner ?? true,
          locale: settings?.locale ?? locale,
        }}
      />
      {open ? (
        <section aria-labelledby="contact-share-title" className="card stack">
          <h3 id="contact-share-title">{t("shareTitle")}</h3>
          <p>{t("shareLink")}</p>
          <p>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              {publicUrl}
            </a>
          </p>
          <label>
            {t("embedCode")}
            <textarea readOnly rows={3} className="code-block" value={`<iframe src="${frameUrl}" title="${t("embedTitle")}" width="100%" height="900" loading="lazy"></iframe>`} />
          </label>
          <p className="meta">{settings?.allowedOrigins.length ? t("embedSites", { sites: settings.allowedOrigins.join(", ") }) : t("embedNoSite")}</p>
          <h4>{t("preview")}</h4>
          <iframe className="contact-preview" src={`/contact/${slug}/cadre`} title={t("previewTitle")} loading="lazy" />
        </section>
      ) : null}
    </>
  );
}
