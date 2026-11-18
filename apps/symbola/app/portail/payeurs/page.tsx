import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireLink } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { LinkBudgetAccessDeniedError, listLinkPayers } from "@/modules/budget/service";
import { PayerVisibilityForm } from "./payer-visibility-form";

// Lot 43 (BUD-06, D8) — « si le client le décide » : un des mariés choisit, pour chaque payeur, s'il ne
// voit que sa part (par défaut) ou tout le budget. Seul le lien d'un des mariés ouvre cette page.
export default async function PayersPage() {
  const access = await requireLink("client");
  if (!access.rights.rubrics.includes("budget") || !(await isBudgetModuleEnabled(access.organizationId))) notFound();
  let payers;
  try {
    payers = await listLinkPayers(access.organizationId, access.linkId);
  } catch (error) {
    if (error instanceof LinkBudgetAccessDeniedError) notFound();
    throw error;
  }
  const t = await getTranslations("Payers");
  const tHelp = await getTranslations("Help");
  const others = payers.filter((payer) => payer.kind !== "couple");
  return (
    <main className="portal payers">
      <h1>{t("portalTitle")}</h1>
      <ScreenHelp title={tHelp("portalPayers.title")} body={tHelp("portalPayers.body")} />
      <p>{t("portalIntro")}</p>
      {others.length === 0 ? <p>{t("noOtherPayer")}</p> : null}
      <ul className="payer-list">
        {others.map((payer) => (
          <li key={payer.id} className="card">
            <h2>{payer.name}</h2>
            <p className="meta">{t(`kinds.${payer.kind}`)}</p>
            <PayerVisibilityForm payerId={payer.id} name={payer.name} ownShareOnly={payer.ownShareOnly} />
          </li>
        ))}
      </ul>
      <p>
        <a href="/portail">{t("backToSpace")}</a>
      </p>
    </main>
  );
}
