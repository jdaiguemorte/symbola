// Lot 11 (L11-PRE-04 à L11-PRE-07, L11-PRE-10, L11-PRE-11) — carnet de prestataires : filtres,
// carte et liste du plus proche au plus loin, « Ajouter au poste », export.
// Lot 16 (L16-PRE-14, ADR 0040) : pastilles par famille (non vides), types de la famille choisie en
// second rang, « à classer » signalé ; couleur et pictogramme de la famille sur la carte.
//
// Lot 73b (PRE-01, PRE-05, PRE-11, UX-05, UX-08, UX-12, UX-13, HUB-14 ; spécification du lot 73, § 5.2 ;
// V1 à V6, P3, P6, P13 ; maquette 18) — le carnet refait :
// - en tête : « Liste · Carte », « Sélectionner », « Nouveau prestataire » (seul bouton plein, sauf quand des
//   fiches sont à classer : « Classer les N fiches » le devient) et un menu « ⋯ » (reprise, exports,
//   réglages) ; « N fiches · une seule par prestataire… » ou « … · N importées le … de « fichier » » ;
// - les familles en pastilles comptées, « À classer » à côté d'elles quand il y en a, puis les métiers de
//   la famille choisie ; la phrase « à classer » avec sa raison ;
// - la barre de filtres libellés (« Rechercher », « Où ? » et son rayon, « Pièces », « Avec vous »,
//   « Évaluation », « Étiquette ») ; chaque filtre posé en pastille qui s'enlève ; « N fiches sur M » ;
// - un tableau dont chaque en-tête trie (dans l'adresse) ; une ligne de 60 px : le nom, seule cible, qui
//   ouvre la fiche (l'aperçu latéral et `?fiche=` disparaissent, V3, sans redirection, P6), le contact et
//   le téléphone, le métier et la ville (et le trajet autour d'un lieu), les mariages faits ensemble,
//   l'évaluation, l'état des pièces en mots (P3) ; « Ajouter à un mariage… » et le menu « ⋯ » ;
// - la vue « Carte » : la carte seule, et les fiches « à placer » ;
// - le carnet vide au gabarit d'aujourd'hui, sans filtres ni carte ;
// - sur téléphone, une carte par fiche, le téléphone à un toucher, les filtres en panneau du bas.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDayMonth, type Locale } from "@symbola/i18n";
import type { VendorDocumentFilter, VendorListItem, VendorSort } from "@symbola/contracts";
import { PageHeader } from "@/app/ui/page-header";
import { FilterBar } from "@/app/ui/filter-bar";
import { requirePlanner } from "@/lib/guards";
import { canSeeEvent } from "@/lib/event-visibility";
import { loadPageTour, onEmptyScreen } from "@/lib/help/page-tour";
import { mapAssets } from "@/lib/map/tiles";
import { PageTour } from "@/app/page-tour";
import { settingsPanelHref } from "@/app/reglages/panels";
import { countVendorsByFamily, countVendorsByType, findVendors, VENDOR_LIST_LIMIT } from "@/modules/vendors/service";
import { ensureVendorFamilies } from "@/lib/vendors/catalog";
import {
  activeFilters,
  clearFiltersHref,
  documentsParam,
  DOCUMENTS_PARAM,
  effectiveSort,
  queryString,
  RADIUS_CHOICES,
  sortHref,
  toFindInput,
  UNCLASSIFIED_FAMILY,
  vendorBookEmptyState,
  type BookQuery,
} from "./filters";
import { isVendorsModuleEnabled } from "./module-access";
import { loadBookSelection } from "./selection";
import { VendorMap, type MapPoint } from "./vendor-map";
import { FamilyIcon } from "./family-icon";
import { documentStateView, shortDayMonth, unclassifiedNotice } from "./book-row";
import { latestBookImport } from "./book-import";
import { BookBoard, SelectToggle, type BookRowData, type BookRowLabels } from "./book-board";
import { BookHeaderMenu, FiltersPanel } from "./book-controls";
import { VendorCreateDialog } from "./vendor-create-dialog";
import { vendorCreateLabels } from "./vendor-create-labels";

// Types « à classer » (sans famille) et fiches sans type, sur la carte.
const UNCLASSIFIED_COLOR = "#78716c";

const SORT_COLUMNS: { sort: VendorSort; key: string }[] = [
  { sort: "name", key: "columnName" },
  { sort: "type", key: "columnTrade" },
  { sort: "worked_with", key: "columnWithYou" },
  { sort: "rating", key: "columnRating" },
  { sort: "documents", key: "columnDocuments" },
];

export default async function VendorBookPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
  const tHelp = await getTranslations("Help");

  if (!(await isVendorsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
  await ensureVendorFamilies(organizationId, locale);
  const query = await searchParams;
  const view = query.vue === "carte" ? "carte" : "liste";
  // NFR-02 : le compte par métier ne sert qu'au second rang (une famille choisie), le dernier import qu'à la
  // phrase « à classer » ; ils ne sont lus que si l'écran les montre.
  const familyChosen = typeof query.famille === "string" && query.famille !== "";
  const [selection, counts, familyCounts, tour] = await Promise.all([
    loadBookSelection(organizationId, query),
    familyChosen ? countVendorsByType(organizationId) : Promise.resolve([]),
    countVendorsByFamily(organizationId),
    loadPageTour(auth.user.id, "vendors", typeof query.visite === "string" ? query.visite : undefined),
  ]);
  const bookImport = (familyCounts.families.find((entry) => entry.familyId === null)?.count ?? 0) > 0 ? await latestBookImport(organizationId) : null;
  const { families, types, tags, tagGroups, filters, center, centerNotFound, results, importFilter } = selection;
  // Lot 73c (SEC-13, lot 52) : un poste d'un mariage hors de l'équipe d'une Planner restreinte ne se nomme pas.
  const target = selection.target && (await canSeeEvent(auth, selection.target.eventId)) ? selection.target : null;
  const typeById = new Map(types.map((type) => [type.id, type]));
  const familyById = new Map(families.map((family) => [family.id, family]));
  const familyOf = (typeId: string | null) => {
    const type = typeId ? typeById.get(typeId) : undefined;
    return type?.familyId ? (familyById.get(type.familyId) ?? null) : null;
  };
  const selectedType = filters.typeId ? (typeById.get(filters.typeId) ?? null) : null;
  // Nombre de fiches (hors archives) par type, par famille et « à classer ». Lot 63e : une fiche compte
  // pour chacun de ses métiers, mais une seule fois dans sa famille et dans le total.
  const countOf = new Map(counts.map((entry) => [entry.typeId, entry.count]));
  const familyCountOf = new Map(familyCounts.families.map((entry) => [entry.familyId, entry.count]));
  const total = familyCounts.total;
  const emptyState = vendorBookEmptyState({ total, results: results.length, types: types.length });
  const familyCount = (familyId: string) => familyCountOf.get(familyId) ?? 0;
  const unclassifiedTypes = types.filter((type) => type.familyId === null);
  const unclassifiedCount = familyCountOf.get(null) ?? 0;
  const visibleFamilies = families.filter((family) => familyCount(family.id) > 0 || family.id === filters.familyId);
  const chosenFamily = filters.familyId ? (familyById.get(filters.familyId) ?? null) : null;
  const rowTypes = filters.unclassified ? unclassifiedTypes : chosenFamily ? types.filter((type) => type.familyId === chosenFamily.id) : [];
  const shownTypes = rowTypes.filter((type) => (countOf.get(type.id) ?? 0) > 0 || type.id === filters.typeId);
  const clearFields = Object.fromEntries(Object.keys(filters.fieldInputs).map((key) => [key, ""]));
  const familyHref = (family: string | null) => `/prestataires${queryString(query, { famille: family ?? "", type: "", ...clearFields })}`;
  const typeHref = (typeId: string | null) => `/prestataires${queryString(query, { type: typeId ?? "", ...clearFields })}`;
  const fieldOf = new Map((selectedType?.fields ?? []).map((field) => [field.id, field]));
  const documentLabel = (filter: VendorDocumentFilter) => t(`filterDocuments.${filter}`);
  const chips = activeFilters("/prestataires", query, filters, {
    text: (text) => t("activeFilterText", { text }),
    around: (place, km) => t("activeFilterAround", { place, km }),
    workedWith: t("filterWorkedWithLabel"),
    rating: (rating) => t("filterRatingAtLeast", { rating }),
    unplaced: t("filterUnplaced"),
    tag: (tagId) => tags.find((tag) => tag.id === tagId)?.label ?? null,
    field: (fieldId, op, value) => {
      const field = fieldOf.get(fieldId);
      return field ? t(`activeFilterField.${op}`, { field: field.label, value }) : null;
    },
    family: (familyId) => familyById.get(familyId)?.label ?? null,
    type: (typeId) => typeById.get(typeId)?.label ?? null,
    unclassified: t("unclassified"),
    documents: (filter) => t("activeFilterDocuments", { documents: documentLabel(filter).toLocaleLowerCase(locale) }),
  });
  const clearHref = chips.length > 0 ? clearFiltersHref("/prestataires", query, filters) : null;
  const sort = effectiveSort(filters, center !== null);
  const notice = unclassifiedNotice({ count: unclassifiedCount, importWithoutTradeColumn: bookImport?.withoutTradeColumn ?? false });
  const exportHref = (format: "csv" | "pdf") => `/prestataires/export${queryString(query, { format })}`;
  const back = `/prestataires${queryString(query)}`;
  const bookIsEmpty = emptyState === "book" || emptyState === "noTypes";

  // Lot 73b (maquette 18, « Les filtres ») : la fiche la plus proche hors du rayon, dite sous la liste.
  const nextRadius = RADIUS_CHOICES.find((radius) => radius > filters.radiusKm) ?? null;
  const outside =
    center && nextRadius && view === "liste"
      ? ((await findVendors({ ...toFindInput(organizationId, { ...filters, radiusKm: nextRadius }, center), sort: "distance", direction: "asc" })).find((vendor) => !results.some((shown) => shown.id === vendor.id)) ?? null)
      : null;

  // La vue « Carte » : la carte seule, et les fiches sans point (« à placer »).
  const points: MapPoint[] =
    view === "carte"
      ? results
          .filter((vendor) => vendor.location)
          .map((vendor) => {
            const family = familyOf(vendor.primaryTypeId);
            return {
              id: vendor.id,
              name: vendor.name,
              latitude: vendor.location!.latitude,
              longitude: vendor.location!.longitude,
              color: family?.color ?? UNCLASSIFIED_COLOR,
              icon: family?.icon ?? "other",
              href: `/prestataires/${vendor.id}`,
            };
          })
      : [];
  const unplaced = view === "carte" ? results.filter((vendor) => !vendor.location) : [];
  const assets = view === "carte" ? await mapAssets() : null;
  const legend = families.filter((family) => results.some((vendor) => vendor.location && familyOf(vendor.primaryTypeId)?.id === family.id));
  const legendUnclassified = results.some((vendor) => vendor.location && !familyOf(vendor.primaryTypeId));

  const subtitle =
    notice && bookImport
      ? t("subtitleImported", { count: total, imported: bookImport.created, date: shortDayMonth(bookImport.appliedAt.toISOString(), locale), file: bookImport.fileName })
      : t("subtitleBook", { count: total });
  const sortLabel = t(`sortBy.${sort.sort}`);
  // « 2 fiches sur 48 » dès que la liste n'en montre qu'une partie (filtres, import, limite de 500).
  const summary = results.length !== total || chips.length > 0 ? t("countOf", { count: results.length, total, sort: sortLabel }) : t("countAll", { count: results.length, sort: sortLabel });
  const tagOptions = tags.map((tag) => ({ id: tag.id, label: tag.label, group: tagGroups.find((group) => group.id === tag.groupId)?.label ?? null }));

  // NFR-02 (500 lignes) : chaque texte de ligne est formaté une fois par jeu de valeurs, et le nom de la fiche
  // se glisse dans un modèle formaté une fois : quelques dizaines de formatages au lieu de cinq mille.
  const formatted = new Map<string, string>();
  const once = (key: string, values?: Record<string, string | number>): string => {
    const cacheKey = values ? `${key}\u0001${JSON.stringify(values)}` : key;
    let text = formatted.get(cacheKey);
    if (text === undefined) {
      text = values ? t(key as Parameters<typeof t>[0], values) : t(key as Parameters<typeof t>[0]);
      formatted.set(cacheKey, text);
    }
    return text;
  };
  // Lot 73b (NFR-02) : la ligne part au navigateur en données compactes, ses textes déjà formatés ; le
  // composant client BookBoard la dessine (même principe que les lignes de « Tâches »).
  const rowData = (vendor: VendorListItem): BookRowData => {
    const primary = vendor.primaryTypeId ? (typeById.get(vendor.primaryTypeId) ?? null) : null;
    const documents = documentStateView(vendor.documentState);
    const dated = (values: Record<string, string | number>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === "date" && typeof value === "string" ? shortDayMonth(value, locale) : value]));
    const reason = filters.documents && documents.reason ? once(`documents.${documents.reason.key}`, dated(documents.reason.values)) : null;
    return {
      id: vendor.id,
      name: vendor.name,
      demo: vendor.isDemo,
      contact: [vendor.contactName ?? once("row.noContact"), vendor.phone].filter(Boolean).join(" · "),
      trade: primary?.label ?? once("unclassified"),
      unclassified: !primary,
      city: `${vendor.city ?? once("row.noCity")}${vendor.travel ? ` · ${once("row.travel", { km: vendor.travel.distanceKm, minutes: vendor.travel.minutes })}` : ""}`,
      withYou: vendor.workedWithCount > 0 ? once("row.weddings", { count: vendor.workedWithCount }) : once("row.never"),
      rating: vendor.rating ? once("row.rating", { rating: vendor.rating }) : once("row.notRated"),
      tone: documents.tone,
      icon: documents.icon,
      documents: `${once(`documents.${documents.message.key}`, dated(documents.message.values))}${documents.more > 0 ? ` ${once("documents.more", { count: documents.more })}` : ""}`,
      reason,
      phone: vendor.phone,
      email: vendor.email,
      onSlot: target?.onSlot.get(vendor.id) ?? null,
    };
  };
  const NAME = "\u0000";
  const PHONE = "\u0002";
  const rowLabels: BookRowLabels = {
    demo: once("demo"),
    add: once("addToEvent.button"),
    addFor: once("addToEvent.buttonFor", { vendor: NAME }),
    menu: once("row.menuLabel", { vendor: NAME }),
    call: once("row.callVendor", { vendor: NAME, phone: PHONE }),
    select: once("row.select", { vendor: NAME }),
    // Lot 73c : le carnet ouvert depuis un poste.
    addToSlot: target ? once("addToSlotShort") : null,
    addToSlotFor: target ? once("addToSlotFor", { vendor: NAME }) : null,
    inComparison: once("rowInComparison"),
    retained: once("rowRetained"),
  };

  return (
    <main className="vendor-book-screen">
      <PageHeader
        title={t("title")}
        subtitle={subtitle}
        actions={
          <>
            {bookIsEmpty ? null : (
              <>
                <nav aria-label={t("viewLabel")} className="segmented vendor-view-switch">
                  <Link href={`/prestataires${queryString(query, { vue: "" })}`} aria-current={view === "liste" ? "page" : undefined}>
                    {t("viewList")}
                  </Link>
                  <Link href={`/prestataires${queryString(query, { vue: "carte" })}`} aria-current={view === "carte" ? "page" : undefined}>
                    {t("viewMap")}
                  </Link>
                </nav>
                {view === "liste" && results.length > 0 ? <SelectToggle /> : null}
              </>
            )}
            {/* Lot 73d (critère 1) : la fenêtre unique de création, ouverte sur le carnet. */}
            <Link className={`button-link${notice ? "" : " button-link-primary"}`} href={`/prestataires${queryString(query, { nouveau: "1" })}`} scroll={false} data-tour="vendor-new">
              {t("newVendor")}
            </Link>
            <BookHeaderMenu importHref="/import?type=vendors#import-form" csvHref={exportHref("csv")} pdfHref={exportHref("pdf")} settingsHref={settingsPanelHref("/prestataires/parametres", "vendors")} />
          </>
        }
      />
      <PageTour {...onEmptyScreen(tour, bookIsEmpty)} helpTitle={tHelp("vendorBook.title")} helpBody={tHelp("vendorBook.body")} />

      {bookIsEmpty ? (
        // Lot 73b (critère 10 ; maquette 18, « Vide ») : le gabarit d'aujourd'hui, sans filtres ni carte.
        <section className="empty-state vendor-book-empty" aria-labelledby="vendor-book-empty">
          <h2 id="vendor-book-empty">{t("emptyScreen.title")}</h2>
          <p>{t("emptyScreen.body")}</p>
          <div className="row-wrap">
            <Link href="/prestataires?nouveau=1" scroll={false} className="button-link button-link-primary">
              {t("newVendor")}
            </Link>
            <Link href="/reprise?ligne=vendor_book" className="button-link">
              <span className="vendor-empty-long">{t("emptyScreen.takeOver")}</span>
              <span className="vendor-empty-short">{t("emptyScreen.takeOverShort")}</span>
            </Link>
          </div>
          <p className="meta">
            {t("emptyScreen.fromBudget")} <Link href="/aide/ecrans/vendorBook">{t("emptyScreen.help")}</Link>
          </p>
        </section>
      ) : (
        <>
          {/* Lot 63b (HUB-14) : la liste filtrée sur un import ; la pastille se retire. */}
          {importFilter ? (
            <p className="row-actions">
              <span className="import-filter-pill">
                {t(importFilter.part === "created" ? "importFilterCreated" : importFilter.part === "updated" ? "importFilterUpdated" : "importFilterPill", { date: formatDayMonth(importFilter.appliedAt, locale) })}
                <Link href={`/prestataires${queryString(query, { import: null, quoi: null })}`} aria-label={t("importFilterRemove", { date: formatDayMonth(importFilter.appliedAt, locale) })}>
                  ×
                </Link>
              </span>
              <Link href={`/import/${importFilter.importId}/journal`}>{t("importFilterJournal")}</Link>
            </p>
          ) : null}

          {/* Lot 73c (critère 8 ; maquette 19, « Depuis le poste ») : le bandeau du poste, et le retour. Un
              bloc, pas un repère : la liste reste la seule région nommée de l'écran. */}
          {target ? (
            <div className="vendor-slot-banner">
              <p className="m-0">{t("slotBanner", { slot: target.slotLabel, event: target.eventLabel })}</p>
              <Link href={`/events/${target.eventId}?onglet=budget&poste=${target.slotId}`} className="button-link">
                {t("slotBannerBack")}
              </Link>
            </div>
          ) : null}

          {/* Lot 73b (critère 8) : la phrase « à classer », sa raison, et son geste, bouton plein. */}
          {notice ? (
            // Un bloc, pas un repère : la liste reste la seule région dont le nom dit « N fiches ».
            <div className="vendor-unclassified">
              <div>
                <p className="vendor-unclassified-title">
                  {t("unclassifiedTitle", { count: notice.count })}
                </p>
                {notice.key === "unclassifiedFromImport" ? <p className="meta">{t("unclassifiedFromImport")}</p> : null}
              </div>
              <Link href="/prestataires/classer" className="button-link button-link-primary">
                {t("classifyButton", { count: notice.count })}
              </Link>
            </div>
          ) : null}

          <nav aria-label={t("familiesFilter")} className="pills vendor-types" data-tour="vendor-types">
            <Link href={familyHref(null)} aria-current={!filters.familyId && !filters.unclassified ? "true" : undefined}>
              {t("allTypesCount", { count: total })}
            </Link>
            {unclassifiedCount > 0 || filters.unclassified ? (
              <Link href={familyHref(UNCLASSIFIED_FAMILY)} aria-current={filters.unclassified ? "true" : undefined}>
                <FamilyIcon color={UNCLASSIFIED_COLOR} icon="other" />
                {t("unclassifiedCount", { count: unclassifiedCount })}
              </Link>
            ) : null}
            {visibleFamilies.map((family) => (
              <Link key={family.id} href={familyHref(family.id)} aria-current={filters.familyId === family.id ? "true" : undefined}>
                <FamilyIcon color={family.color} icon={family.icon} />
                {t("typeCount", { label: family.label, count: familyCount(family.id) })}
              </Link>
            ))}
          </nav>
          {(chosenFamily || filters.unclassified) && shownTypes.length > 0 ? (
            <nav aria-label={t("familyTypesFilter", { family: chosenFamily?.label ?? t("unclassified") })} className="pills pills-secondary vendor-family-types">
              <Link href={typeHref(null)} aria-current={filters.typeId === null ? "true" : undefined}>
                {t("allTradesCount", { count: chosenFamily ? familyCount(chosenFamily.id) : unclassifiedCount })}
              </Link>
              {shownTypes.map((type) => (
                <Link key={type.id} href={typeHref(type.id)} aria-current={filters.typeId === type.id ? "true" : undefined}>
                  {t("typeCount", { label: type.label, count: countOf.get(type.id) ?? 0 })}
                </Link>
              ))}
            </nav>
          ) : null}

          <div data-tour="vendor-filters">
            <FiltersPanel count={results.length} active={chips.length} clearHref={clearHref}>
              <FilterBar
                label={t("filtersLabel")}
                applyLabel={t("filterApply")}
                preserve={Object.fromEntries(
                  [
                    ["famille", filters.familyId ?? (filters.unclassified ? UNCLASSIFIED_FAMILY : null)],
                    ["type", filters.typeId],
                    ["evenement", filters.eventId],
                    ["poste", filters.slotId],
                    ["vue", view === "carte" ? "carte" : null],
                    ["tri", typeof query.tri === "string" ? query.tri : null],
                    ["sens", typeof query.sens === "string" ? query.sens : null],
                    // Lot 63b (HUB-14) : le filtre sur un import reste quand on en ajoute un autre.
                    ["import", importFilter?.importId ?? null],
                    ["quoi", importFilter?.part === "created" ? "crees" : importFilter?.part === "updated" ? "maj" : null],
                  ].filter((entry): entry is [string, string] => Boolean(entry[1])),
                )}
              >
                <label className="vendor-filter-search">
                  <span>{t("filterSearch")}</span>
                  <input type="search" name="q" defaultValue={filters.text} placeholder={t("filterSearchPlaceholder")} />
                </label>
                {/* Lot 73b : « Où ? », un champ de 200 px, et son rayon, actif seulement avec un lieu. */}
                <label className="vendor-filter-where">
                  <span>{t("filterWhere")}</span>
                  <input type="text" name="autour" data-apply="blur" defaultValue={filters.aroundText.startsWith("fiche:") ? "" : filters.aroundText} placeholder={t("filterAroundPlaceholder")} />
                </label>
                <label>
                  <span>{t("filterRadiusShort")}</span>
                  <select name="rayon" defaultValue={String(filters.radiusKm)} disabled={!filters.aroundText}>
                    {RADIUS_CHOICES.map((radius) => (
                      <option key={radius} value={radius}>
                        {t("radiusWithin", { km: radius })}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("filterDocumentsLabel")}</span>
                  <select name="pieces" defaultValue={filters.documents ? documentsParam(filters.documents) : ""}>
                    <option value="">{t("filterDocumentsAll")}</option>
                    {Object.entries(DOCUMENTS_PARAM).map(([param, filter]) => (
                      <option key={param} value={param}>
                        {documentLabel(filter)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("filterWithYou")}</span>
                  <select name="deja" defaultValue={filters.workedWith ? "1" : ""}>
                    <option value="">{t("any")}</option>
                    <option value="1">{t("filterWorkedWithLabel")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("filterRating")}</span>
                  <select name="note" defaultValue={filters.minRating ? String(filters.minRating) : ""}>
                    <option value="">{t("filterAllRatings")}</option>
                    {[5, 4, 3, 2].map((value) => (
                      <option key={value} value={value}>
                        {t("filterRatingAtLeast", { rating: value })}
                      </option>
                    ))}
                  </select>
                </label>
                {tags.length > 0 ? (
                  <label>
                    <span>{t("filterTag")}</span>
                    <select name="etiquette" defaultValue={filters.tagId ?? ""}>
                      <option value="">{t("allTags")}</option>
                      {/* Lot 20 (décision 5) : rangées par groupe, comme sur la fiche. */}
                      {[...tagGroups.map((group) => ({ key: group.id, label: group.label, tags: tags.filter((tag) => tag.groupId === group.id) })), { key: "other", label: t("tagGroupOther"), tags: tags.filter((tag) => tag.groupId === null) }]
                        .filter((section) => section.tags.length > 0)
                        .map((section) =>
                          tagGroups.length === 0 ? (
                            section.tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {tag.label}
                              </option>
                            ))
                          ) : (
                            <optgroup key={section.key} label={section.label}>
                              {section.tags.map((tag) => (
                                <option key={tag.id} value={tag.id}>
                                  {tag.label}
                                </option>
                              ))}
                            </optgroup>
                          ),
                        )}
                    </select>
                  </label>
                ) : null}
                {selectedType?.fields
                  .filter((field) => field.isFilter)
                  .flatMap((field) =>
                    field.kind === "boolean" || field.kind === "choice" || field.kind === "text"
                      ? [
                          <label key={field.id}>
                            <span>{field.label}</span>
                            {field.kind === "text" ? (
                              <input type="text" name={`eq_${field.id}`} data-apply="blur" defaultValue={filters.fieldInputs[`eq_${field.id}`] ?? ""} />
                            ) : (
                              <select name={`eq_${field.id}`} defaultValue={filters.fieldInputs[`eq_${field.id}`] ?? ""}>
                                <option value="">{t("any")}</option>
                                {(field.kind === "boolean" ? ["oui", "non"] : field.choices).map((choice) => (
                                  <option key={choice} value={choice}>
                                    {field.kind === "boolean" ? t(choice === "oui" ? "yes" : "no") : choice}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>,
                        ]
                      : [
                          <label key={`${field.id}-min`}>
                            <span>{t("fieldMin", { label: field.label })}</span>
                            <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" data-apply="blur" name={`min_${field.id}`} defaultValue={filters.fieldInputs[`min_${field.id}`] ?? ""} />
                          </label>,
                          <label key={`${field.id}-max`}>
                            <span>{t("fieldMax", { label: field.label })}</span>
                            <input type={field.kind === "time" ? "time" : "text"} inputMode="decimal" data-apply="blur" name={`max_${field.id}`} defaultValue={filters.fieldInputs[`max_${field.id}`] ?? ""} />
                          </label>,
                        ],
                  )}
              </FilterBar>
            </FiltersPanel>
            {centerNotFound ? (
              <p className="field-hint" role="status">
                {t("centerNotFound")}
              </p>
            ) : null}
            {chips.length > 0 ? (
              <div className="filter-chips" role="group" aria-label={t("activeFiltersLabel")}>
                <span className="muted">{t("activeFiltersCount", { count: chips.length })}</span>
                {chips.map((chip) => (
                  <Link key={chip.key + chip.label} href={chip.href} className="filter-chip" aria-label={t("removeFilter", { filter: chip.label })}>
                    {chip.label} <span aria-hidden="true">×</span>
                  </Link>
                ))}
                <Link href={clearHref!} className="button-link filter-chips-clear">
                  {t("clearFilters")}
                </Link>
              </div>
            ) : null}
          </div>

          <section className="vendor-results-section" aria-labelledby="results-title" data-tour="vendor-results">
            <div className="vendor-results-head">
              <h2 id="results-title" className="vendor-results-count">
                {summary}
              </h2>
              {view === "liste" && results.length > 0 ? (
                <p className="meta vendor-sort-said">
                  {t("sortSaid", { sort: t(`sortColumn.${sort.sort}`) })}
                  {sort.natural ? null : ` · ${t("sortReversed")}`}
                </p>
              ) : null}
            </div>
            {results.length >= VENDOR_LIST_LIMIT ? <p className="field-hint">{t("listLimit", { count: VENDOR_LIST_LIMIT })}</p> : null}
            {emptyState === "filters" ? (
              <p>
                {t("emptyFiltered", { total })} {clearHref ? <Link href={clearHref}>{t("clearFilters")}</Link> : null}
              </p>
            ) : null}

            {view === "liste" && results.length > 0 ? (
              <BookBoard
                tags={tagOptions}
                exportFields={Object.fromEntries((["autour", "rayon", "tri", "sens"] as const).flatMap((key) => (typeof query[key] === "string" && query[key] ? [[key, query[key] as string]] : [])))}
                exportListHrefs={{ csv: exportHref("csv"), pdf: exportHref("pdf") }}
                back={back}
                rows={results.map(rowData)}
                labels={rowLabels}
                target={target ? { eventId: target.eventId, slotId: target.slotId } : null}
                caption={t("tableCaption")}
                head={
                  <thead>
                    <tr>
                      <th scope="col" className="vendor-select-cell">
                        <span className="sr-only">{t("columnSelect")}</span>
                      </th>
                      {SORT_COLUMNS.map((column) => (
                        <th key={column.sort} scope="col" aria-sort={sort.sort === column.sort ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                          <Link href={sortHref("/prestataires", query, filters, center !== null, column.sort)} scroll={false} className="vendor-sort-link">
                            {t(column.key)}
                            {sort.sort === column.sort ? <span aria-hidden="true">{sort.direction === "asc" ? " ↑" : " ↓"}</span> : null}
                          </Link>
                        </th>
                      ))}
                      <th scope="col" className="vendor-cell-actions">
                        <span className="sr-only">{t("columnActions")}</span>
                      </th>
                    </tr>
                  </thead>
                }
              />
            ) : null}

            {outside?.travel ? (
              <p className="meta vendor-outside">
                {t("outsideRadius", { vendor: outside.name, city: outside.city ?? t("row.noCity"), km: Math.round(outside.travel.distanceKm) })}{" "}
                <Link href={`/prestataires${queryString(query, { rayon: String(nextRadius) })}`}>{t("widenRadius", { km: nextRadius! })}</Link>
              </p>
            ) : null}
            {center && view === "liste" && results.length > 0 ? <p className="muted">{t("travelHint")}</p> : null}

            {view === "carte" && assets ? (
              <div className="vendor-map-view">
                <VendorMap
                  points={points}
                  assets={assets}
                  around={center ? { latitude: center.latitude, longitude: center.longitude, radiusKm: filters.radiusKm } : null}
                  label={t("mapLabel", { count: points.length })}
                  missingTilesNotice={t("mapNoTiles")}
                  controls={{ zoomIn: t("mapZoomIn"), zoomOut: t("mapZoomOut") }}
                  summary={t("mapSummary", { placed: points.length, unplaced: unplaced.length })}
                />
                {legend.length > 0 || legendUnclassified ? (
                  <ul className="vendor-map-legend" aria-label={t("mapLegend")}>
                    {legend.map((family) => (
                      <li key={family.id}>
                        <FamilyIcon color={family.color} icon={family.icon} />
                        {family.label}
                      </li>
                    ))}
                    {legendUnclassified ? (
                      <li>
                        <FamilyIcon color={UNCLASSIFIED_COLOR} icon="other" />
                        {t("unclassified")}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {unplaced.length > 0 ? (
                  <section className="vendor-unplaced" aria-labelledby="vendor-unplaced-title">
                    <h3 id="vendor-unplaced-title">{t("unplacedTitle", { count: unplaced.length })}</h3>
                    <ul>
                      {unplaced.map((vendor) => (
                        <li key={vendor.id}>
                          <Link href={`/prestataires/${vendor.id}`}>{vendor.name}</Link>
                          <span className="meta"> · {vendor.city ?? t("row.noCity")}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      )}
      {query.nouveau === "1" ? <VendorCreateDialog options={{ labels: await vendorCreateLabels(), types, families, tags, tagGroups, slot: null }} closeHref={`/prestataires${queryString(query, { nouveau: null })}`} /> : null}
    </main>
  );
}
