// EVT-03 / EVT-17, refait au lot 13 (HUB-16) — rubrique « Lignes du budget »
// des Paramètres : tableau aligné (icône, ligne, actions) ; ajouter ou
// modifier une ligne ouvre le panneau latéral (?ligne=nouvelle ou ?ligne=id).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { LoadStarterVendorSlotsForm } from "./default-vendor-slot-forms";
import { removeDefaultVendorSlotAction } from "./vendor-slot-actions";
import { AddBudgetLineForm, EditBudgetLineForm } from "./budget-line-panel-forms";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { ListTable } from "@/app/ui/list-table";
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
      <HelpButton title={tHelp("eventsSettings.title")} body={tHelp("eventsSettings.body")} />
      <p>{t("defaultVendorSlotsIntro")}</p>

      {lines.length === 0 ? (
        <>
          <p>{t("noDefaultVendorSlots")}</p>
          <LoadStarterVendorSlotsForm />
        </>
      ) : (
        <ListTable
          label={t("defaultVendorSlotsTitle")}
          head={
            <tr>
              <th scope="col">{t("lineIconColumn")}</th>
              <th scope="col">{t("vendorColumnSlot")}</th>
              <th scope="col">
                <span className="sr-only">{t("actionsColumn")}</span>
              </th>
            </tr>
          }
        >
          {lines.map((line) => (
            <tr key={line.id} aria-current={line.id === editing?.id ? "true" : undefined}>
              <td className="icon-cell">
                <BudgetLineIcon icon={line.icon} label={line.label} decorative />
              </td>
              <th scope="row">{line.label}</th>
              <td className="actions">
                {isOwner ? (
                  <Link href={`${BASE}?ligne=${line.id}`} scroll={false} className="button-link" aria-label={t("editBudgetLine", { label: line.label })}>
                    {t("edit")}
                  </Link>
                ) : null}{" "}
                <form action={removeDefaultVendorSlotAction} className="inline-form">
                  <input type="hidden" name="defaultVendorSlotId" value={line.id} />
                  <button type="submit" className="button-ghost" aria-label={t("removeVendorSlot", { label: line.label })}>
                    {t("remove")}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </ListTable>
      )}
      {lines.length > 0 ? <LoadStarterVendorSlotsForm /> : null}

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
