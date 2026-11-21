"use client";

// Lot 11 (L11-PRE-01 / L11-PRE-02) — fiche d'un prestataire. Lot 63e (PRE-01, PRE-11 ; ADR 0105, ADR
// 0107, maquettes M4 et M11) : une modification longue, en rubriques (identité, métiers et étiquettes,
// coordonnées, tarifs et note). Les métiers se cochent, l'un est principal (couleur et icône sur la
// carte) ; les étiquettes et les champs de chaque métier coché s'ajoutent, avec les étiquettes « pour
// tous ». « Suivant » enregistre et passe à la rubrique suivante, sans y obliger ; tous les champs
// restent dans le formulaire, quelle que soit la rubrique affichée.
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import type { Vendor, VendorFamily, VendorFieldValue, VendorTag, VendorTagGroup, VendorType, VendorTypeField } from "@/modules/vendors/service";
import { saveVendorAction, type VendorFormState } from "./actions";
import { FamilyIcon } from "./family-icon";
import { tagSectionsFor, VENDOR_FORM_RUBRICS, type VendorFormRubric } from "./vendor-trades";

// Jeton ink-muted de DESIGN.md (attribut SVG fill, qui ne lit pas les variables CSS).
const UNCLASSIFIED_COLOR = "#5A6372";

function initialFieldValue(field: VendorTypeField, value: VendorFieldValue | undefined): string {
  if (value === undefined) return "";
  if (field.kind === "amount" && typeof value === "number") {
    const rest = value % 100;
    return rest === 0 ? String(Math.trunc(value / 100)) : `${Math.trunc(value / 100)},${String(rest).padStart(2, "0")}`;
  }
  return String(value);
}

function FieldInput({ field, value }: { field: VendorTypeField; value: VendorFieldValue | undefined }) {
  const t = useTranslations("VendorBook");
  const name = `field_${field.id}`;
  if (field.kind === "boolean") {
    return (
      <label className="checkbox">
        <input type="checkbox" name={name} defaultChecked={value === true} />
        {field.label}
      </label>
    );
  }
  if (field.kind === "choice") {
    return (
      <label>
        {field.label}
        <select name={name} defaultValue={typeof value === "string" ? value : ""}>
          <option value="">—</option>
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      {field.kind === "amount" ? t("fieldAmountLabel", { label: field.label }) : field.label}
      <input
        type={field.kind === "time" ? "time" : "text"}
        inputMode={field.kind === "number" || field.kind === "amount" ? "decimal" : undefined}
        name={name}
        defaultValue={initialFieldValue(field, value)}
      />
    </label>
  );
}

// Lot 20 (décision 5, ADR 0049) — étiquettes en pastilles, rangées par groupe. Un groupe « palier »
// se choisit en un seul segment (le même nom de bouton radio d'une section à l'autre).
function TagChips({ legend, tags, groups, selected }: { legend: string; tags: VendorTag[]; groups: VendorTagGroup[]; selected: string[] }) {
  const t = useTranslations("VendorBook");
  const sections = [
    ...groups.map((group) => ({
      key: group.id,
      label: group.label,
      exclusive: group.exclusive,
      tags: tags.filter((tag) => tag.groupId === group.id),
    })),
    {
      key: "other",
      label: groups.length > 0 ? t("tagGroupOther") : t("tags"),
      exclusive: false,
      tags: tags.filter((tag) => tag.groupId === null || !groups.some((group) => group.id === tag.groupId)),
    },
  ].filter((section) => section.tags.length > 0);
  if (sections.length === 0) return null;
  return (
    <fieldset className="tag-fieldset">
      <legend>{legend}</legend>
      {sections.map((section) => (
        <fieldset key={section.key} className="tag-group">
          <legend>{section.exclusive ? t("tagGroupTierLegend", { group: section.label }) : section.label}</legend>
          <div className={section.exclusive ? "tag-tier" : "tag-chips"}>
            {section.exclusive ? (
              <label className="tag-chip">
                <input type="radio" name={`tagTier-${section.key}`} value="" defaultChecked={!section.tags.some((tag) => selected.includes(tag.id))} />
                <span>{t("tagTierNone")}</span>
              </label>
            ) : null}
            {section.tags.map((tag) => (
              <label key={tag.id} className="tag-chip">
                {section.exclusive ? (
                  <input type="radio" name={`tagTier-${section.key}`} value={tag.id} defaultChecked={selected.includes(tag.id)} />
                ) : (
                  <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selected.includes(tag.id)} />
                )}
                <span>{tag.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  );
}

// Lot 63e (PRE-01, maquette M4) — les métiers, rangés par famille : une case par métier et, pour les
// métiers cochés, le choix du principal. Les familles sans métier coché sont repliées.
function TradesPicker({
  types,
  families,
  checked,
  primary,
  onToggle,
  onPrimary,
}: {
  types: VendorType[];
  families: VendorFamily[];
  checked: string[];
  primary: string | null;
  onToggle: (typeId: string, on: boolean) => void;
  onPrimary: (typeId: string) => void;
}) {
  const t = useTranslations("VendorBook");
  const groups = [
    ...families.map((family) => ({
      key: family.id,
      label: family.label,
      color: family.color,
      icon: family.icon,
      items: types.filter((type) => type.familyId === family.id),
    })),
    {
      key: "none",
      label: t("typeUnclassified"),
      color: UNCLASSIFIED_COLOR,
      icon: "other",
      items: types.filter((type) => !families.some((family) => family.id === type.familyId)),
    },
  ].filter((group) => group.items.length > 0);
  const used = groups.filter((group) => group.items.some((type) => checked.includes(type.id)));
  const others = groups.filter((group) => !used.includes(group));
  const renderGroup = (group: (typeof groups)[number]) => (
    <fieldset key={group.key} className="trade-group">
      <legend className="family-cell">
        <FamilyIcon color={group.color} icon={group.icon} />
        {group.label}
      </legend>
      <ul className="trade-list">
        {group.items.map((type) => {
          const on = checked.includes(type.id);
          return (
            <li key={type.id} className="trade-row">
              <label className="checkbox">
                <input type="checkbox" name="typeIds" value={type.id} checked={on} onChange={(event) => onToggle(type.id, event.target.checked)} />
                {type.label}
              </label>
              {on ? (
                <label className="checkbox trade-primary">
                  <input type="radio" name="primaryTypeId" value={type.id} checked={primary === type.id} onChange={() => onPrimary(type.id)} />
                  <span>{t("tradePrimary")}</span>
                  <span className="sr-only">{t("tradePrimaryOf", { type: type.label })}</span>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
  if (types.length === 0) return <p className="muted">{t("tradesNone")}</p>;
  return (
    <fieldset className="trades-fieldset">
      <legend>{t("trades")}</legend>
      <p className="muted">{t("tradesHint")}</p>
      {used.map(renderGroup)}
      {others.length > 0 ? (
        <details className="trade-more" open={used.length === 0}>
          <summary>{used.length > 0 ? t("tradesAddOther") : t("tradesChoose")}</summary>
          {others.map(renderGroup)}
        </details>
      ) : null}
    </fieldset>
  );
}

export function VendorForm({
  types,
  tags,
  tagGroups = [],
  families = [],
  vendor = null,
  back = "",
  closeHref = null,
  initialRubric = "identity",
}: {
  types: VendorType[];
  tags: VendorTag[];
  tagGroups?: VendorTagGroup[];
  // Lot 16 (L16-PRE-14) : types rangés par famille.
  families?: VendorFamily[];
  vendor?: Vendor | null;
  back?: string;
  // Lot 63e (ADR 0107) : la fiche se modifie dans une fenêtre ; closeHref la ferme. Sans closeHref
  // (nouvelle fiche), les rubriques s'affichent dans la page.
  closeHref?: string | null;
  initialRubric?: VendorFormRubric;
}) {
  const t = useTranslations("VendorBook");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [state, action, pending] = useActionState<VendorFormState, FormData>(saveVendorAction, {});
  const [rubric, setRubric] = useState<VendorFormRubric>(initialRubric);
  const [checked, setChecked] = useState<string[]>(vendor?.typeIds ?? []);
  const [primary, setPrimary] = useState<string | null>(vendor?.primaryTypeId ?? null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const index = VENDOR_FORM_RUBRICS.indexOf(rubric);
  const next = VENDOR_FORM_RUBRICS[index + 1] ?? null;
  const previous = index > 0 ? VENDOR_FORM_RUBRICS[index - 1]! : null;
  const chosen = checked.map((id) => types.find((type) => type.id === id)).filter((type): type is VendorType => Boolean(type));
  const ordered = [...chosen].sort((a, b) => Number(b.id === primary) - Number(a.id === primary));
  const tagSections = tagSectionsFor(ordered, families, tags);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  // Enregistrée : la fenêtre passe à la rubrique suivante, ou se ferme.
  const handled = useRef<VendorFormState | null>(null);
  useEffect(() => {
    if (!state.success || handled.current === state) return;
    handled.current = state;
    if (state.intent === "close" && closeHref) router.push(closeHref, { scroll: false });
    else if (state.intent === "next" && next) setRubric(next);
  }, [state, closeHref, next, router]);

  const toggle = (typeId: string, on: boolean) => {
    const list = on ? [...checked, typeId] : checked.filter((id) => id !== typeId);
    setChecked(list);
    if (on && !primary) setPrimary(typeId);
    if (!on && primary === typeId) setPrimary(list[0] ?? null);
  };

  const close = () => {
    if (closeHref) router.push(closeHref, { scroll: false });
  };

  const show = (key: VendorFormRubric) => (rubric === key ? undefined : true);
  // Dans la fenêtre, son titre est le h2 ; dans la page « Nouveau prestataire », le h1.
  const RubricHeading = closeHref ? "h3" : "h2";
  const form = (
    <form
      action={action}
      className="vendor-form"
      aria-labelledby={closeHref ? titleId : undefined}
      // Un champ obligatoire vide ramène à sa rubrique (le navigateur ne peut montrer un champ caché).
      onInvalidCapture={() => setRubric("identity")}
    >
      {vendor ? <input type="hidden" name="vendorId" value={vendor.id} /> : null}
      {/* Lot 39b (UX-09) : la saisie en cours est gardée et se reprend sur tout appareil. */}
      <DraftKeeper formKey={vendor ? `vendor:${vendor.id}` : "vendor-new"} submission={state} saved={Boolean(state.success)} />
      {back ? <input type="hidden" name="back" value={back} /> : null}
      {next ? <input type="hidden" name="nextRubric" value={next} /> : null}
      <div className="window-rubrics">
        <nav className="window-rubrics-nav" aria-label={t("rubricsLabel")}>
          <ol>
            {VENDOR_FORM_RUBRICS.map((key, position) => (
              <li key={key}>
                <button type="button" className="window-rubric" aria-current={rubric === key ? "step" : undefined} onClick={() => setRubric(key)}>
                  <span className="window-rubric-number" aria-hidden="true">
                    {position + 1}
                  </span>
                  {t(`rubric.${key}`)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="window-rubrics-body">
          <p className="meta">
            {t("rubricProgress", {
              index: index + 1,
              count: VENDOR_FORM_RUBRICS.length,
            })}
          </p>
          <section hidden={show("identity")} aria-label={t("rubric.identity")} className="stack">
            <RubricHeading>{t("rubric.identity")}</RubricHeading>
            <fieldset>
              <legend className="sr-only">{t("identity")}</legend>
              <label>
                <span>
                  {t("name")}
                  <RequiredMark />
                </span>
                <input type="text" name="name" required defaultValue={vendor?.name ?? ""} autoComplete="organization" />
              </label>
              <label>
                {t("siret")}
                <input type="text" name="siret" inputMode="numeric" defaultValue={vendor?.siret ?? ""} />
              </label>
              <label>
                {t("website")}
                <input type="url" name="website" defaultValue={vendor?.website ?? ""} autoComplete="url" placeholder="https://" />
              </label>
              {VENDOR_SOCIAL_NETWORKS.map((network) => (
                <label key={network}>
                  {t(`social.${network}`)}
                  <input type="url" name={`social_${network}`} defaultValue={vendor?.socialLinks.find((link) => link.network === network)?.url ?? ""} placeholder="https://" />
                </label>
              ))}
            </fieldset>
            <RequiredLegend text={tCommon("requiredLegend")} />
          </section>
          <section hidden={show("trades")} aria-label={t("rubric.trades")} className="stack">
            <RubricHeading>{t("rubric.trades")}</RubricHeading>
            <TradesPicker types={types} families={families} checked={checked} primary={primary} onToggle={toggle} onPrimary={setPrimary} />
            {tagSections.map((section) => (
              <TagChips
                key={section.key}
                legend={section.kind === "family" ? t("tagsFor", { trades: section.label }) : section.kind === "common" ? t("tagsForAll") : t("tags")}
                tags={section.tags}
                groups={tagGroups}
                selected={vendor?.tagIds ?? []}
              />
            ))}
            {ordered
              .filter((type) => type.fields.length > 0)
              .map((type) => (
                <fieldset key={type.id}>
                  <legend>{t("typeFields", { type: type.label })}</legend>
                  {type.fields.map((field) => (
                    <FieldInput key={field.id} field={field} value={vendor?.fieldValues[field.id]} />
                  ))}
                </fieldset>
              ))}
          </section>
          <section hidden={show("contact")} aria-label={t("rubric.contact")} className="stack">
            <RubricHeading>{t("rubric.contact")}</RubricHeading>
            <fieldset>
              <legend>{t("contact")}</legend>
              <label>
                {t("contactName")}
                <input type="text" name="contactName" defaultValue={vendor?.contactName ?? ""} autoComplete="name" />
              </label>
              <label>
                {t("phone")}
                <input type="tel" name="phone" defaultValue={vendor?.phone ?? ""} autoComplete="tel" />
              </label>
              <label>
                {t("email")}
                <input type="email" name="email" defaultValue={vendor?.email ?? ""} autoComplete="email" />
              </label>
            </fieldset>
            <fieldset>
              <legend>{t("address")}</legend>
              <label>
                {t("addressLine")}
                <input type="text" name="addressLine" defaultValue={vendor?.addressLine ?? ""} autoComplete="street-address" />
              </label>
              <label>
                {t("postalCode")}
                <input type="text" name="postalCode" defaultValue={vendor?.postalCode ?? ""} autoComplete="postal-code" />
              </label>
              <label>
                {t("city")}
                <input type="text" name="city" defaultValue={vendor?.city ?? ""} autoComplete="address-level2" />
              </label>
              <label>
                {t("country")}
                <input type="text" name="country" defaultValue={vendor?.country ?? "FR"} maxLength={2} autoComplete="country" />
              </label>
            </fieldset>
            <p className="muted">{t("addressHint")}</p>
          </section>
          <section hidden={show("prices")} aria-label={t("rubric.prices")} className="stack">
            <RubricHeading>{t("rubric.prices")}</RubricHeading>
            {/* Lot 28c (PRE-01, D8) : évaluation interne et tarifs indicatifs. */}
            <label>
              {t("rating")}
              <select name="rating" defaultValue={vendor?.rating ? String(vendor.rating) : ""}>
                <option value="">{t("ratingNone")}</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {t("ratingValue", { rating: value })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("indicativePrices")}
              <textarea name="indicativePrices" rows={2} defaultValue={vendor?.indicativePrices ?? ""} />
            </label>
            <p className="muted">{t("indicativePricesHint")}</p>
            {/* Lot 48a (DAT-08) : une note confidentielle se change dans sa section, jamais ici. */}
            {vendor?.internalNoteConfidential ? (
              <p className="muted">{t("internalNoteConfidentialElsewhere")}</p>
            ) : (
              <>
                <label>
                  {t("internalNote")}
                  <textarea name="internalNote" rows={3} defaultValue={vendor?.internalNote ?? ""} />
                </label>
                <FreeTextNotice />
                <p className="muted">{t("internalNoteHint")}</p>
              </>
            )}
            {vendor ? <p className="muted">{t("rubricElsewhere")}</p> : null}
          </section>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{state.notice ?? t("saved")}</p> : null}
          <div className="window-actions">
            {previous ? (
              <button type="button" className="button-secondary" onClick={() => setRubric(previous)}>
                {t("rubricPrevious")}
              </button>
            ) : (
              <span />
            )}
            {closeHref ? (
              <button type="submit" name="intent" value="close" className="button-secondary" disabled={pending}>
                {t("saveAndClose")}
              </button>
            ) : null}
            {next ? (
              <button type="submit" name="intent" value="next" disabled={pending}>
                {vendor ? t("rubricNext", { rubric: t(`rubric.${next}`) }) : t("createAndNext", { rubric: t(`rubric.${next}`) })}
              </button>
            ) : (
              <button type="submit" name="intent" value="close" disabled={pending}>
                {vendor ? t("save") : t("create")}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );

  if (!closeHref) return form;
  return (
    <dialog
      ref={dialog}
      className="window window-long"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="window-head">
        <button type="button" className="button-ghost window-back" onClick={close}>
          ‹ {t("windowBack")}
        </button>
        <h2 id={titleId}>{t("editTitle", { vendor: vendor?.name ?? "" })}</h2>
        <button type="button" className="button-ghost window-close" onClick={close}>
          {t("windowClose")}
        </button>
      </div>
      {form}
    </dialog>
  );
}
