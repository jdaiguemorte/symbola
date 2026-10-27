import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import type { TourStep } from "@symbola/ui";
import { getOrganizationProfile } from "@/modules/hub/service";
import { listCatalogItems } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isTourInitiallyOpen } from "@/lib/module-tour";
import { ModuleTourAndHelp } from "@/app/module-tour";
import { isQuotesModuleEnabled } from "../module-access";
import { formatRate } from "../quote-display";
import { archiveCatalogItemAction } from "./actions";
import { CatalogItemForm } from "./catalog-item-form";

export default async function QuoteCatalogPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const tTour = await getTranslations("Tour");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("catalogTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const { sql, db } = createAppConnection();
  let profile;
  try {
    profile = await getOrganizationProfile(db, organizationId);
  } finally {
    await sql.end();
  }
  const items = await listCatalogItems(organizationId);
  const defaultRate = profile.vatRegime === "franchise" ? 0 : (profile.vatRateDefaultBasisPoints ?? 0);

  return (
    <main>
      <h1>{t("catalogTitle")}</h1>
      <ModuleTourAndHelp
        moduleKey="quotes"
        tourInitiallyOpen={await isTourInitiallyOpen(auth.user.id, "quotes")}
        tourSteps={tTour.raw("quotes") as TourStep[]}
        skipLabel={tTour("skip")}
        nextLabel={tTour("next")}
        finishLabel={tTour("finish")}
        helpTitle={tHelp("quotesCatalog.title")}
        helpBody={tHelp("quotesCatalog.body")}
        relaunchLabel={tHelp("relaunchTour")}
      />
      {profile.vatRegime === "franchise" ? <p role="status">{t("franchiseRatesIgnored")}</p> : null}

      {items.length === 0 ? <p>{t("noCatalogItems")}</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <p>
              <strong>{item.label}</strong>
              {item.category ? ` — ${item.category}` : ""} — {formatAmount(item.unitPriceCents, locale)} / {item.unit} —{" "}
              {t("vatRateValue", { rate: formatRate(item.vatRateBasisPoints, locale) })}
            </p>
            {item.description ? <p>{item.description}</p> : null}
            <details>
              <summary>{t("editItemNamed", { label: item.label })}</summary>
              <CatalogItemForm item={item} defaultVatRateBasisPoints={defaultRate} />
            </details>
            <form action={archiveCatalogItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <button type="submit">{t("archiveItem", { label: item.label })}</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>{t("newItemTitle")}</h2>
      <CatalogItemForm defaultVatRateBasisPoints={defaultRate} />
    </main>
  );
}
