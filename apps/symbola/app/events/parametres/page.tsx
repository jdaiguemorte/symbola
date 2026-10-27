import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listDefaultVendorSlots, listLossReasons, listProspectSources } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { ProspectSourceForm } from "./prospect-source-form";
import { LossReasonForm } from "./loss-reason-form";
import { DefaultVendorSlotForm, LoadStarterVendorSlotsForm } from "./default-vendor-slot-forms";
import { removeDefaultVendorSlotAction } from "./vendor-slot-actions";

export default async function EventsSettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [sources, reasons, defaultVendorSlots] = await Promise.all([
    listProspectSources(organizationId),
    listLossReasons(organizationId),
    listDefaultVendorSlots(organizationId),
  ]);

  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <HelpButton title={tHelp("eventsSettings.title")} body={tHelp("eventsSettings.body")} />

      <h2>{t("sourcesTitle")}</h2>
      <ul>
        {sources.map((source) => (
          <li key={source.id}>{source.label}</li>
        ))}
      </ul>
      <ProspectSourceForm />

      <h2>{t("lossReasonsTitle")}</h2>
      <ul>
        {reasons.map((reason) => (
          <li key={reason.id}>
            {reason.label}
            {reason.isFreeText ? ` (${t("freeTextTag")})` : ""}
          </li>
        ))}
      </ul>
      <LossReasonForm />

      {/* EVT-03 : postes reçus par chaque nouvel événement. */}
      <h2>{t("defaultVendorSlotsTitle")}</h2>
      <p>{t("defaultVendorSlotsIntro")}</p>
      {defaultVendorSlots.length === 0 ? <p>{t("noDefaultVendorSlots")}</p> : null}
      <ul>
        {defaultVendorSlots.map((slot) => (
          <li key={slot.id}>
            {slot.label}{" "}
            <form action={removeDefaultVendorSlotAction} style={{ display: "inline" }}>
              <input type="hidden" name="defaultVendorSlotId" value={slot.id} />
              <button type="submit">{t("removeVendorSlot", { label: slot.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <DefaultVendorSlotForm />
      <LoadStarterVendorSlotsForm />
    </main>
  );
}
