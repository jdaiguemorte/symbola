"use client";

// Lot 73d (PRE-01, PRE-02, UX-03, UX-10, HUB-19 ; spécification du lot 73, § 5.4, critères 1 à 5 ; V10,
// C-46, C-49, P-14, P-18 ; maquette 20, « Créer ») — la fenêtre unique de création d'un prestataire, la même
// au carnet et depuis un poste du budget, et « Modifier » sur la fiche.
//
// - Une fenêtre courte : « Nom * », « Métier * » (proposé d'après le poste ; « À classer » en dernier, choisi
//   exprès), « Contact », « Téléphone », « E-mail », « Ville » ; « Plus de détails » ouvre en place tout ce
//   que portaient les quatre rubriques d'avant (adresse, SIRET, site et réseaux, étiquettes, évaluation,
//   tarifs, note, champs du métier).
// - « * obligatoire » dit avant l'envoi ; envoyée incomplète, aucune bulle du navigateur : le message de
//   Symbola sous chaque champ (70b), la saisie reste.
// - Un nom proche d'une fiche du carnet est signalé sous le champ, avec un lien vers elle ; la création reste
//   possible.
// - Depuis un poste : « Comment l'ajouter à « {poste} » ? », rien de coché ; « Créer et ajouter » ; sur un
//   poste déjà pourvu, « Remplacer {nom} » ou « Retenir aussi » (P12), sur place.
// - « Modifier » : la même fenêtre, complète (plusieurs métiers et le principal), « Plus de détails » ouvert.
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { ErrorSummary } from "@/app/ui/error-summary";
import { FieldError } from "@/app/ui/field-error";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { useFeedback } from "@/app/ui/feedback";
import { useFieldValidation } from "@/app/ui/use-field-validation";
import { vendorCreateFieldsSchema } from "@/lib/forms/vendor-create-fields";
import type { Vendor, VendorType } from "@/modules/vendors/service";
import { addToEventAction, undoAdditionAction } from "./add-to-event-actions";
import { saveVendorRecordAction, similarVendorAction, type VendorCreateOptions, type VendorCreateState } from "./vendor-create-actions";
import { fillLabel, tradeGroups, type VendorCreateLabels } from "./vendor-create-model";
import type { SimilarVendor } from "./vendor-create-similar";
import { FieldInput, TagChips, TradesPicker } from "./vendor-form-fields";
import { tagSectionsFor } from "./vendor-trades";

const SIMILAR_DEBOUNCE_MS = 300;

export function VendorCreateDialog({
  options,
  vendor = null,
  initialName = "",
  detailsOpen = false,
  closeHref = null,
  onClose,
  onAdded,
}: {
  options: VendorCreateOptions;
  // Modifier : la fiche à modifier.
  vendor?: Vendor | null;
  // Depuis la recherche du panneau du poste qui n'a rien trouvé : le nom, et seulement le nom.
  initialName?: string;
  // « Ajouter » d'une valeur absente de la fiche : « Plus de détails » s'ouvre.
  detailsOpen?: boolean;
  // La fenêtre est une adresse (le carnet « ?nouveau=1 », la fiche « ?modifier=1 ») : la fermer y revient.
  closeHref?: string | null;
  onClose?: () => void;
  // Depuis un poste : la fiche est créée et ajoutée.
  onAdded?: () => void;
}) {
  // Les textes viennent de l'écran qui ouvre la fenêtre (espace réservé au serveur, NFR-02).
  const t = (key: keyof VendorCreateLabels, values?: Record<string, string>) => fillLabel(options.labels[key], values);
  const tBook = useTranslations("VendorBook");
  const tAdd = useTranslations("VendorAddition");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const feedback = useFeedback();
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), slot: useId(), similar: useId(), siretHint: useId(), pricesHint: useId(), noteHint: useId() };
  const editing = vendor !== null;
  const slot = editing ? null : options.slot;
  // L'envoi se suit dans sa propre suite (et non par un effet) : depuis un poste, la ligne du budget se
  // redessine quand la fiche y est ajoutée, et la fenêtre avec elle ; le message de retour part quand même.
  const [state, setState] = useState<VendorCreateState>({});
  const [submitting, startSubmit] = useTransition();
  const validation = useFieldValidation(vendorCreateFieldsSchema({ fromSlot: slot !== null, edit: editing }), state.fieldErrors, {
    nameRequired: t("errors.nameRequired"),
    nameTooLong: t("errors.nameTooLong"),
    tradeRequired: t("errors.tradeRequired"),
    emailInvalid: t("errors.emailInvalid"),
    modeRequired: t("errors.modeRequired"),
  });
  const [typeId, setTypeId] = useState<string>(slot?.proposedTypeId ?? "");
  const [checked, setChecked] = useState<string[]>(vendor?.typeIds ?? []);
  const [primary, setPrimary] = useState<string | null>(vendor?.primaryTypeId ?? null);
  const [name, setName] = useState(vendor?.name ?? initialName);
  const [similar, setSimilar] = useState<SimilarVendor | null>(null);
  const [pendingAdd, startAdd] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [asking, setAsking] = useState<VendorCreateState["pending"] | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const close = () => {
    if (onClose) onClose();
    else if (closeHref) router.push(closeHref, { scroll: false });
  };

  // Un nom proche d'une fiche du carnet (critère 4).
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      void similarVendorAction({ name, exceptId: vendor?.id ?? null }).then((found) => {
        if (current) setSimilar(found);
      });
    }, SIMILAR_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [name, vendor?.id]);

  const handle = (result: VendorCreateState) => {
    if (result.saved) {
      feedback?.show({ title: t("saved"), ...(result.saved.notice ? { detail: result.saved.notice } : {}) });
      close();
      router.refresh();
    } else if (result.added) {
      showAdded(result.added);
    } else if (result.pending) {
      setAsking(result.pending);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.onSubmit(event)) return;
    const data = new FormData(event.currentTarget);
    startSubmit(async () => {
      const result = await saveVendorRecordAction({}, data);
      setState(result);
      handle(result);
    });
  };

  const showAdded = (added: { title: string; detail: string; undoId: string; eventId: string }) => {
    feedback?.show({
      title: added.title,
      detail: added.detail,
      action: {
        kind: "undo",
        label: tAdd("undo"),
        run: async () => {
          const undone = await undoAdditionAction({ undoId: added.undoId, eventId: added.eventId });
          feedback.show(undone.ok ? { title: undone.message } : { tone: "error", title: undone.message });
          router.refresh();
        },
      },
    });
    onAdded?.();
    close();
    router.refresh();
  };

  // La fiche est créée ; l'ajout attendait une réponse (P12, seuil du budget).
  const finishAddition = (mode: "compare" | "retain" | "replace" | "retain_also", confirmed = false) => {
    if (!asking) return;
    const pending = asking;
    startAdd(async () => {
      const result = await addToEventAction({ eventId: pending.eventId, slotId: pending.slotId, vendorIds: [pending.vendorId], mode, confirmed });
      if (result.ok) {
        setAsking(null);
        showAdded(result);
        return;
      }
      if (result.kind === "choice") setAsking({ ...pending, kind: "choice", retainedName: result.retainedName });
      else if (result.kind === "confirm") setAsking({ vendorId: pending.vendorId, eventId: pending.eventId, slotId: pending.slotId, kind: "confirm", message: result.message, mode: mode === "compare" ? "compare" : "retain" });
      else setAddError(result.error);
    });
  };

  const toggle = (id: string, on: boolean) => {
    const list = on ? [...checked, id] : checked.filter((entry) => entry !== id);
    setChecked(list);
    if (on && !primary) setPrimary(id);
    if (!on && primary === id) setPrimary(list[0] ?? null);
  };

  const chosenTypes = (editing ? checked : [typeId]).map((id) => options.types.find((type) => type.id === id)).filter((type): type is VendorType => Boolean(type));
  const orderedTypes = [...chosenTypes].sort((a, b) => Number(b.id === primary) - Number(a.id === primary));
  const tagSections = tagSectionsFor(orderedTypes, options.families, options.tags);
  const groups = tradeGroups(options.types, options.families, t("tradeUnclassified"));
  const proposedLabel = slot?.proposedTypeId ? (options.types.find((type) => type.id === slot.proposedTypeId)?.label ?? null) : null;
  const created = asking !== null && asking !== undefined;
  const title = editing ? t("editTitle", { name: vendor.name }) : t("title");

  return (
    <dialog
      ref={dialog}
      className="window window-short vendor-create"
      aria-labelledby={ids.title}
      aria-describedby={slot ? ids.slot : undefined}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="window-head">
        {/* ADR 0107 : sur téléphone, la fenêtre prend l'écran et dit « Retour ». */}
        <button type="button" className="button-ghost window-back" onClick={close}>
          ‹ {tBook("windowBack")}
        </button>
        <h2 id={ids.title}>{title}</h2>
        <button type="button" className="button-ghost window-close" onClick={close}>
          {t("close")}
        </button>
      </div>
      {slot ? (
        <p id={ids.slot} className="meta vendor-create-for">
          {slot.eventLabel ? t("forSlot", { slot: slot.slotLabel, event: slot.eventLabel }) : t("forSlotNoEvent", { slot: slot.slotLabel })}
        </p>
      ) : null}
      <form noValidate onSubmit={submit} onInput={validation.onInput} className="vendor-create-form">
        {vendor ? <input type="hidden" name="vendorId" value={vendor.id} /> : null}
        {slot ? (
          <>
            <input type="hidden" name="eventId" value={slot.eventId} />
            <input type="hidden" name="slotId" value={slot.slotId} />
          </>
        ) : null}
        {/* Lot 39b (UX-09) : la saisie en cours est gardée et se reprend sur tout appareil. */}
        <DraftKeeper formKey={vendor ? `vendor:${vendor.id}` : slot ? `vendor-new:${slot.slotId}` : "vendor-new"} submission={state} saved={Boolean(state.saved || state.added || state.pending)} />
        <ErrorSummary
          errors={validation.errors}
          labels={{ name: t("name"), typeId: t("trade"), email: t("email"), mode: slot ? t("how", { slot: slot.slotLabel }) : "" }}
          fieldId={validation.fieldId}
        />
        <fieldset className="vendor-create-main" disabled={created}>
          <legend className="sr-only">{t("mainLegend")}</legend>
          <label>
            <span>
              {t("name")}
              <RequiredMark />
            </span>
            <input
              type="text"
              name="name"
              maxLength={200}
              autoComplete="organization"
              defaultValue={name}
              onChange={(event) => setName(event.target.value)}
              {...validation.fieldProps("name")}
              aria-describedby={[validation.errorFor("name") ? validation.errorId("name") : null, similar ? ids.similar : null].filter(Boolean).join(" ") || undefined}
            />
            <FieldError id={validation.errorId("name")} message={validation.errorFor("name")} />
          </label>
          {similar ? (
            <p id={ids.similar} className="field-hint vendor-create-similar">
              {similar.city ? t("similar", { name: similar.name, city: similar.city }) : t("similarNoCity", { name: similar.name })}{" "}
              <Link href={`/prestataires/${similar.id}`} target="_blank" rel="noopener">
                {t("similarSee")}
                <span className="sr-only"> — {similar.name}</span>
              </Link>
            </p>
          ) : null}
          {editing ? (
            <TradesPicker types={options.types} families={options.families} checked={checked} primary={primary} onToggle={toggle} onPrimary={setPrimary} />
          ) : (
            <label>
              <span>
                {t("trade")}
                <RequiredMark />
              </span>
              <select name="typeId" value={typeId} onChange={(event) => setTypeId(event.target.value)} {...validation.fieldProps("typeId")}>
                <option value="">{t("tradeChoose")}</option>
                {groups.map((group, index) =>
                  group.label ? (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    group.options.map((option) => (
                      <option key={`${index}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  ),
                )}
              </select>
              <FieldError id={validation.errorId("typeId")} message={validation.errorFor("typeId")} />
              <span className="field-hint">
                {proposedLabel && slot && typeId === slot.proposedTypeId ? `${t("tradeProposed", { slot: slot.slotLabel })} ` : ""}
                {t("tradeMore")}
              </span>
            </label>
          )}
          <label>
            {t("contactName")}
            <input type="text" name="contactName" maxLength={200} autoComplete="name" defaultValue={vendor?.contactName ?? ""} />
          </label>
          <label>
            {t("phone")}
            <input type="tel" name="phone" maxLength={40} autoComplete="tel" defaultValue={vendor?.phone ?? ""} />
          </label>
          <label>
            {t("email")}
            <input type="email" name="email" maxLength={320} autoComplete="email" defaultValue={vendor?.email ?? ""} {...validation.fieldProps("email")} />
            <FieldError id={validation.errorId("email")} message={validation.errorFor("email")} />
          </label>
          <label>
            {t("city")}
            <input type="text" name="city" maxLength={120} autoComplete="address-level2" defaultValue={vendor?.city ?? ""} />
          </label>
          <details className="vendor-create-details" open={editing || detailsOpen}>
            <summary>{editing ? t("detailsEdit") : t("details")}</summary>
            <div className="stack">
              <fieldset>
                <legend>{tBook("address")}</legend>
                <label>
                  {tBook("addressLine")}
                  <input type="text" name="addressLine" defaultValue={vendor?.addressLine ?? ""} autoComplete="street-address" />
                </label>
                <label>
                  {tBook("postalCode")}
                  <input type="text" name="postalCode" defaultValue={vendor?.postalCode ?? ""} autoComplete="postal-code" />
                </label>
                <label>
                  {tBook("country")}
                  <input type="text" name="country" defaultValue={vendor?.country ?? "FR"} maxLength={2} autoComplete="country" />
                </label>
                <p className="field-hint">{tBook("addressHint")}</p>
              </fieldset>
              <label>
                {tBook("siret")}
                <input type="text" name="siret" inputMode="numeric" defaultValue={vendor?.siret ?? ""} aria-describedby={[ids.siretHint, validation.errorFor("siret") ? validation.errorId("siret") : null].filter(Boolean).join(" ")} {...(validation.errorFor("siret") ? { "aria-invalid": true } : {})} />
                <span id={ids.siretHint} className="field-hint">
                  {t("siretHint")}
                </span>
                <FieldError id={validation.errorId("siret")} message={validation.errorFor("siret")} />
              </label>
              <fieldset>
                <legend>{t("links")}</legend>
                <label>
                  {tBook("website")}
                  <input type="url" name="website" defaultValue={vendor?.website ?? ""} autoComplete="url" placeholder="https://" {...(validation.errorFor("website") ? { "aria-invalid": true, "aria-describedby": validation.errorId("website") } : {})} />
                  <FieldError id={validation.errorId("website")} message={validation.errorFor("website")} />
                </label>
                {VENDOR_SOCIAL_NETWORKS.map((network) => (
                  <label key={network}>
                    {tBook(`social.${network}`)}
                    <input type="url" name={`social_${network}`} defaultValue={vendor?.socialLinks.find((link) => link.network === network)?.url ?? ""} placeholder="https://" />
                  </label>
                ))}
              </fieldset>
              {tagSections.map((section) => (
                <TagChips
                  key={section.key}
                  legend={section.kind === "family" ? tBook("tagsFor", { trades: section.label }) : section.kind === "common" ? tBook("tagsForAll") : tBook("tags")}
                  tags={section.tags}
                  groups={options.tagGroups}
                  selected={vendor?.tagIds ?? []}
                />
              ))}
              {orderedTypes
                .filter((type) => type.fields.length > 0)
                .map((type) => (
                  <fieldset key={type.id}>
                    <legend>{tBook("typeFields", { type: type.label })}</legend>
                    {type.fields.map((field) => (
                      <FieldInput key={field.id} field={field} value={vendor?.fieldValues[field.id]} />
                    ))}
                  </fieldset>
                ))}
              <label>
                {tBook("rating")}
                <select name="rating" defaultValue={vendor?.rating ? String(vendor.rating) : ""}>
                  <option value="">{tBook("ratingNone")}</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {tBook("ratingValue", { rating: value })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tBook("indicativePrices")}
                <textarea name="indicativePrices" rows={2} defaultValue={vendor?.indicativePrices ?? ""} aria-describedby={ids.pricesHint} />
              </label>
              <p id={ids.pricesHint} className="field-hint">
                {tBook("indicativePricesHint")}
              </p>
              {/* Lot 48a (DAT-08) : une note confidentielle se change dans sa section, jamais ici. */}
              {vendor?.internalNoteConfidential ? (
                <p className="field-hint">{tBook("internalNoteConfidentialElsewhere")}</p>
              ) : (
                <>
                  <label>
                    {tBook("internalNote")}
                    <textarea name="internalNote" rows={3} defaultValue={vendor?.internalNote ?? ""} aria-describedby={ids.noteHint} />
                  </label>
                  <FreeTextNotice />
                  <p id={ids.noteHint} className="field-hint">
                    {tBook("internalNoteHint")}
                  </p>
                </>
              )}
            </div>
          </details>
          {editing ? null : <p className="field-hint">{t("later")}</p>}
          {slot ? (
            <fieldset className="vendor-create-how" aria-describedby={validation.errorFor("mode") ? validation.errorId("mode") : undefined}>
              <legend>
                {t("how", { slot: slot.slotLabel })}
                <RequiredMark />
              </legend>
              {(["compare", "retain"] as const).map((mode, index) => (
                <label key={mode} className="standing-option">
                  <input type="radio" name="mode" value={mode} {...(index === 0 ? validation.fieldProps("mode") : {})} />
                  <span>
                    <strong>{t(mode)}</strong>
                    <span className="meta">{t(mode === "compare" ? "compareHint" : "retainHint")}</span>
                  </span>
                </label>
              ))}
              <FieldError id={validation.errorId("mode")} message={validation.errorFor("mode")} />
            </fieldset>
          ) : null}
        </fieldset>
        {asking?.kind === "choice" ? (
          // P12 : le poste a déjà un retenu ; « Remplacer {nom} » d'abord, « Retenir aussi » ensuite.
          <div className="notice slot-panel-ask" role="group" aria-label={tAdd("choiceLabel", { name: asking.retainedName })}>
            <p>{t("createdAsk")}</p>
            <span className="slot-panel-ask-option">
              <button type="button" className="button-primary" disabled={pendingAdd} onClick={() => finishAddition("replace")}>
                {tAdd("replace", { name: asking.retainedName })}
              </button>
              <span className="meta">{tAdd("replaceHint", { name: asking.retainedName })}</span>
            </span>
            <span className="slot-panel-ask-option">
              <button type="button" className="button-secondary" disabled={pendingAdd} onClick={() => finishAddition("retain_also")}>
                {tAdd("retainAlso")}
              </button>
              <span className="meta">{tAdd("retainAlsoHint")}</span>
            </span>
          </div>
        ) : null}
        {asking?.kind === "confirm" ? (
          <div className="notice notice-attention slot-panel-ask">
            <p>{t("createdAsk")}</p>
            <p role="alert">{asking.message}</p>
            <button type="button" className="button-primary" disabled={pendingAdd} onClick={() => finishAddition(asking.mode, true)}>
              {tAdd("confirmRetain")}
            </button>
          </div>
        ) : null}
        {state.error ? <p role="alert">{state.error}</p> : null}
        {addError ? <p role="alert">{addError}</p> : null}
        <div className="window-actions vendor-create-actions">
          <RequiredLegend text={slot ? `${tCommon("requiredLegend")} · ${t("joinsBook")}` : tCommon("requiredLegend")} />
          <button type="button" className="button-secondary" onClick={close}>
            {created ? t("close") : tCommon("cancel")}
          </button>
          {created ? null : (
            <button type="submit" className="button-primary" disabled={submitting}>
              {editing ? t("save") : slot ? t("createAndAdd") : t("create")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
