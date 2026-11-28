import { ImportedFields } from "../../imported-fields";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";
import { listCatalogItems } from "@/modules/quotes/service";
import { requirePlanner } from "@/lib/guards";
import { PageTour } from "@/app/page-tour";
import { loadPageTour, onEmptyScreen } from "@/lib/help/page-tour";
import { isQuotesModuleEnabled } from "../module-access";
import { formatRate } from "../quote-display";
import { formatDecimal } from "../decimal-input";
import { CatalogItemForm } from "./catalog-item-form";
import { CatalogList } from "./catalog-list";

export default async function QuoteCatalogPage({ searchParams }: { searchParams: Promise<{ visite?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Quotes");

  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;

  if (!(await isQuotesModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{tMenu("rubrics.catalog.label")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const db = appDatabase();
  const profile = await getOrganizationProfile(db, organizationId);
  const items = await listCatalogItems(organizationId);
  const inputLocale = locale === "en" ? "en" : "fr";
  const defaultRate = profile.vatRegime === "franchise" ? 0 : (profile.vatRateDefaultBasisPoints ?? 0);

  return (
    <main>
      <h1>{tMenu("rubrics.catalog.label")}</h1>
      <PageTour
        {...onEmptyScreen(await loadPageTour(auth.user.id, "quotes", (await searchParams).visite), items.length === 0)}
        helpTitle={tHelp("quotesCatalog.title")}
        helpBody={tHelp("quotesCatalog.body")}
      />
      {profile.vatRegime === "franchise" ? <p role="status">{t("franchiseRatesIgnored")}</p> : null}

      {/* Lot 62b (UX-13, D1) : un tableau, une ligne par article, deux actions de ligne. */}
      <section className="card" aria-labelledby="catalog-list-title" data-tour="quotes-catalog">
        <h2 id="catalog-list-title" className="sr-only">
          {t("catalogTableLabel")}
        </h2>
        {items.length === 0 ? (
          <p>{t("noCatalogItems")}</p>
        ) : (
          <CatalogList
            items={items.map((item) => ({
              id: item.id,
              label: item.label,
              description: item.description ?? "",
              category: item.category ?? "",
              unit: item.unit,
              nature: item.nature ?? "service",
              unitPrice: formatDecimal(item.unitPriceCents, 2, inputLocale),
              vatRate: formatDecimal(item.vatRateBasisPoints, 2, inputLocale),
              priceText: formatAmount(item.unitPriceCents, locale),
              vatText: formatRate(item.vatRateBasisPoints, locale),
            }))}
            extras={Object.fromEntries(items.map((item) => [item.id, <ImportedFields key={item.id} fields={item.importedFields} compact />]))}
          />
        )}
      </section>
      <section className="card" aria-labelledby="catalog-new-title">
        <h2 id="catalog-new-title" data-tour="catalog-new">
          {t("newItemTitle")}
        </h2>
        <CatalogItemForm defaultVatRateBasisPoints={defaultRate} />
      </section>
    </main>
  );
}
