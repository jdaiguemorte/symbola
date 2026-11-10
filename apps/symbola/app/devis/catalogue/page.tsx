import { ImportedFields } from "../../imported-fields";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";
import { listCatalogItems } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { PageTour } from "@/app/page-tour";
import { loadPageTour } from "@/lib/help/page-tour";
import { isQuotesModuleEnabled } from "../module-access";
import { formatRate } from "../quote-display";
import { archiveCatalogItemAction } from "./actions";
import { CatalogItemForm } from "./catalog-item-form";

export default async function QuoteCatalogPage({ searchParams }: { searchParams: Promise<{ visite?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("catalogTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const db = appDatabase();
  const profile = await getOrganizationProfile(db, organizationId);
  const items = await listCatalogItems(organizationId);
  const defaultRate = profile.vatRegime === "franchise" ? 0 : (profile.vatRateDefaultBasisPoints ?? 0);

  return (
    <main>
      <h1>{t("catalogTitle")}</h1>
      <PageTour
        {...await loadPageTour(auth.user.id, "quotes", (await searchParams).visite)}
        helpTitle={tHelp("quotesCatalog.title")}
        helpBody={tHelp("quotesCatalog.body")}
      />
      {profile.vatRegime === "franchise" ? <p role="status">{t("franchiseRatesIgnored")}</p> : null}

      {items.length === 0 ? <p>{t("noCatalogItems")}</p> : null}
      <ul data-tour="quotes-catalog">
        {items.map((item) => (
          <li key={item.id}>
            <p>
              <strong>{item.label}</strong>
              {item.category ? ` — ${item.category}` : ""} — {formatAmount(item.unitPriceCents, locale)} / {item.unit} —{" "}
              {t("vatRateValue", { rate: formatRate(item.vatRateBasisPoints, locale) })}
            </p>
            {item.description ? <p>{item.description}</p> : null}
            <ImportedFields fields={item.importedFields} compact />
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

      <h2 data-tour="catalog-new">{t("newItemTitle")}</h2>
      <CatalogItemForm defaultVatRateBasisPoints={defaultRate} />
    </main>
  );
}
