// Lot 13 (L13-HUB-15, L13-HUB-16) — rubrique « Relances des prospects » des Paramètres (« Délais de
// relance » jusqu'au lot 61, confondue avec les relances de devis et de paiement).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getFollowUpDelays, isModuleEnabled } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { FollowUpForm } from "./follow-up-form";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { getProspectFollowUpSettings } from "@/modules/events/service";
import { listMessageTemplates } from "@/modules/hub/service";
import { BrochureForm, ProspectFollowUpForm } from "./prospect-follow-up-form";

export default async function FollowUpSettingsPage() {
  const auth = await requirePlanner();

  const t = await getTranslations("Settings");

  const tMenu = await getTranslations("SettingsMenu");

  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const delays = await getFollowUpDelays(db, auth.user.organizationId);
  // Lot 45 (CRM-06, CRM-05 ; D2) : relances envoyées aux prospects et brochure, si le module Évènements
  // est ouvert (ARC-07).
  const eventsOn = await isEventsModuleEnabled(auth.user.organizationId);
  const quotesOn = await isModuleEnabled(db, auth.user.organizationId, "quotes");
  const [prospectSettings, messageTemplates] = eventsOn ? await Promise.all([getProspectFollowUpSettings(auth.user.organizationId), listMessageTemplates(auth.user.organizationId)]) : [null, []];
  return (
    <main>
      <h1>{tMenu("rubrics.followUp.label")}</h1>
      <ScreenHelp title={tHelp("followUps.title")} body={tHelp("followUps.body")} />
      <p>{t("followUpIntro")}</p>
      {/* Lot 61 : deux rubriques parlent de relances ; chacune renvoie à l'autre. */}
      {quotesOn ? (
        <p className="field-hint">
          {t("followUpSeeAlso")} <Link href="/devis/relances">{t("followUpSeeAlsoLink")}</Link>
        </p>
      ) : null}
      <section className="card" aria-labelledby="follow-up-delays">
        <h2 id="follow-up-delays">{t("followUpDelaysTitle")}</h2>
        <FollowUpForm quoteDays={delays.quoteFollowUpDays} prospectDays={delays.prospectFollowUpDays} />
      </section>
      {prospectSettings ? (
        <>
          <section className="card">
            <ProspectFollowUpForm settings={prospectSettings} templates={messageTemplates.map((template) => ({ id: template.id, name: template.name }))} />
          </section>
          <section className="card">
            <BrochureForm brochure={prospectSettings.brochure} />
          </section>
        </>
      ) : null}
    </main>
  );
}
