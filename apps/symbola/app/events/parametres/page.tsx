// EVT-03 / EVT-17, refait au lot 13 (HUB-16) — rubrique « Lignes du budget »
// des Paramètres : tableau aligné (icône, ligne, actions) ; ajouter ou
// modifier une ligne ouvre le panneau latéral (?ligne=nouvelle ou ?ligne=id).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { LoadStarterVendorSlotsForm } from "./default-vendor-slot-forms";
import { AddBudgetLineForm, EditBudgetLineForm } from "./budget-line-panel-forms";
import { SortableBudgetLines } from "./sortable-budget-lines";
import { SidePanel } from "@/app/ui/side-panel";

const BASE = "/events/parametres";

export default async function EventsSettingsPage({ searchParams }: { searchParams: Promise<{ ligne?: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const { ligne } = await searchParams;
  const lines = await listDefaultVendorSlots(organizationId);
  const isOwner = auth.user.role === "owner";
  const editing = isOwner && ligne && ligne !== "nouvelle" ? lines.find((line) => line.id === ligne) : undefined;
  const adding = ligne === "nouvelle";

  return (
    <main>
      <div className="section-head">
        <h1>{t("defaultVendorSlotsTitle")}</h1>
        <Link href={`${BASE}?ligne=nouvelle`} scroll={false} className="button-link button-link-primary">
          {t("addBudgetLineButton")}
        </Link>
      </div>
      <ScreenHelp title={tHelp("eventsSettings.title")} body={tHelp("eventsSettings.body")} />
      <p>{t("defaultVendorSlotsIntro")}</p>
      {lines.length > 1 ? <p className="muted">{t("defaultVendorSlotsReorderHint")}</p> : null}

      {lines.length === 0 ? (
        <p>{t("noDefaultVendorSlots")}</p>
      ) : (
        <SortableBudgetLines
          lines={lines.map((line) => ({ id: line.id, label: line.label, icon: line.icon }))}
          isOwner={isOwner}
          base={BASE}
          editingId={editing?.id ?? null}
        />
      )}
      {/* Toujours au même endroit : son message de succès survit à l'apparition du tableau. */}
      <LoadStarterVendorSlotsForm />

      {editing ? (
        <SidePanel title={t("editBudgetLine", { label: editing.label })} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <EditBudgetLineForm key={editing.id} line={editing} />
        </SidePanel>
      ) : null}
      {adding ? (
        <SidePanel title={t("addBudgetLineTitle")} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <AddBudgetLineForm />
        </SidePanel>
      ) : null}
    </main>
  );
}
