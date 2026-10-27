import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { getEvent, listDefaultVendorSlots } from "@/modules/events/service";
import { getEventBudget, listAllocationModels, listBudgetLines } from "@/modules/budget/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isBudgetModuleEnabled, isValidId } from "../module-access";
import { BudgetSimulationForm } from "./budget-simulation-form";
import { BudgetLinesTable } from "./budget-lines-table";

export default async function EventBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const { eventId } = await params;
  const t = await getTranslations("Budget");
  const tHelp = await getTranslations("Help");

  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId)) notFound();

  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();

  const [budget, models, vendorSlots, linesView] = await Promise.all([
    getEventBudget(organizationId, eventId),
    listAllocationModels(organizationId),
    listDefaultVendorSlots(organizationId),
    listBudgetLines(organizationId, eventId),
  ]);
  const locale = (await getLocale()) as Locale;
  const clientNames = event.clients.length ? event.clients.map((client) => client.firstName).join(" & ") : t("noClient");

  return (
    <main>
      <h1>
        {t("title")} — {clientNames}
      </h1>
      <HelpButton title={tHelp("budgetDetail.title")} body={tHelp("budgetDetail.body")} />

      {models.length === 0 ? <p role="status">{t("noModelsYet")}</p> : null}

      <BudgetSimulationForm eventId={eventId} models={models} budget={budget} locale={locale} vendorSlots={vendorSlots} />

      {budget ? (
        <>
          <p>
            {t("totalAmount")} : {formatAmount(budget.totalAmountCents, locale)}
          </p>
          <p>
            {t("guestCount")} : {budget.guestCount}
          </p>
          <p>
            {t("costPerGuest")} : {formatAmount(budget.costPerGuestCents, locale)}
          </p>
          <p>
            {t("allocated")} : {formatAmount(budget.allocatedCents, locale)}
          </p>
          <p>
            {t("remaining")} : {formatAmount(budget.remainingCents, locale)}
          </p>
        </>
      ) : null}

      <h2>{t("linesTitle")}</h2>
      <BudgetLinesTable eventId={eventId} view={linesView} canConfirm={budget !== null} locale={locale} />
    </main>
  );
}
