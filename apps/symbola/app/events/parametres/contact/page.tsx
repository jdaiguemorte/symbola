// Lot 44 (CRM-01 ; D1 à D3, D7 ; ADR 0084) — Paramètres › Formulaire de contact : ouvrir le formulaire,
// son adresse, les champs facultatifs montrés, l'adresse de la politique de confidentialité (sans elle,
// le formulaire ne s'ouvre pas), les sites autorisés à l'encadrer, l'e-mail de nouvelle demande. Puis
// le lien à partager, le code à copier dans le site et l'aperçu. Réservé à la titulaire.
import { getLocale, getTranslations } from "next-intl/server";
import { parseEnv } from "@symbola/env";
import { appDatabase } from "@symbola/db/client";
import { getContactFormSettings, suggestContactFormSlug } from "@/modules/events/service";
import { getOrganizationContact } from "@/modules/hub/service";
import { requireOwner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "../../module-access";
import { ContactSettingsForm } from "./contact-settings-form";

export default async function ContactFormSettingsPage() {
  const auth = await requireOwner();
  const t = await getTranslations("ContactForm.settings");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const settings = await getContactFormSettings(organizationId);
  const slug = settings?.slug ?? (await suggestContactFormSlug((await getOrganizationContact(appDatabase(), organizationId)).name));
  const base = parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");
  const publicUrl = `${base}/contact/${slug}`;
  const frameUrl = `${publicUrl}/cadre`;
  const open = Boolean(settings?.active && settings.privacyPolicyUrl);

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("eventsContactForm.title")} body={tHelp("eventsContactForm.body")} />
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
          <h2 id="contact-share-title">{t("shareTitle")}</h2>
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
          <h3>{t("preview")}</h3>
          <iframe className="contact-preview" src={`/contact/${slug}/cadre`} title={t("previewTitle")} loading="lazy" />
        </section>
      ) : null}
    </main>
  );
}
