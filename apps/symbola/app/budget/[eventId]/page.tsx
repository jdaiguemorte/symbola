// Lot 63c (BUD-01, BUD-03, BUD-04 ; #40, maquette M9) — une seule vue du budget : /budget/<id> mène à
// l'onglet « Budget et prestataires » de la fiche, qui contrôle lui-même la session, l'organisation et
// les modules. Le détail (simulation, HT, exports, payeurs) est sous /budget/<id>/detail.
import { notFound, redirect } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { getTranslations } from "next-intl/server";
import { isBudgetModuleEnabled, isValidId } from "../module-access";

export default async function EventBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  // Sans le module Budget, l'écran le dit (ARC-07), comme avant le lot 63c.
  if (!(await isBudgetModuleEnabled(auth.user.organizationId))) {
    const t = await getTranslations("Budget");
    const tHelp = await getTranslations("Help");
    return (
      <main>
        <h1>{t("title")}</h1>
        <ScreenHelp title={tHelp("budgetDetail.title")} body={tHelp("budgetDetail.body")} />
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const { eventId } = await params;
  if (!isValidId(eventId)) notFound();
  redirect(`/events/${eventId}?onglet=budget`);
}
