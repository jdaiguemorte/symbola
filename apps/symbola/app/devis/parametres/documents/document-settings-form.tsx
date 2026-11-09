"use client";

// Lot 17 (DEV-09 à DEV-11) — réglages des documents et aperçu en direct :
// couleur (six nuances ou couleur libre), police, textes du devis et de la
// facture, pied de page, IBAN et BIC. L'aperçu suit la saisie ; le PDF
// d'exemple, lui, prend les réglages enregistrés.
import {
  useActionState,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  DocumentFont,
  DocumentSettings,
  SellerSnapshot,
} from "@symbola/contracts";
import type { Locale } from "@symbola/i18n";
import { documentAppearance } from "@/lib/documents/appearance";
import type { Translate } from "../../document-labels";
import {
  updateDocumentSettingsAction,
  type DocumentSettingsFormState,
} from "./actions";
import { DocumentPreview } from "./document-preview";
import { sampleDocumentModel, type SampleContext } from "./sample";

type Swatch = { color: string; label: string };

// Pastille de couleur : posée en CSSOM (la CSP refuse les attributs style).
export function SwatchDot({ color }: { color: string }) {
  const dot = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    dot.current?.style.setProperty("background-color", color);
  }, [color]);
  return <span ref={dot} className="swatch-dot" aria-hidden="true" />;
}

export function DocumentSettingsForm({
  settings,
  seller,
  context,
  swatches,
  defaultColor,
  starters,
  limits,
  logoUrl,
}: {
  settings: DocumentSettings;
  seller: SellerSnapshot;
  context: SampleContext;
  swatches: Swatch[];
  defaultColor: string;
  starters: { quoteTerms: string; invoiceTerms: string };
  limits: { intro: number; terms: number };
  logoUrl: string | null;
}) {
  const t = useTranslations("Documents");
  const tQuotes = useTranslations("Quotes");
  const locale = useLocale() as Locale;
  const [state, formAction, pending] = useActionState<
    DocumentSettingsFormState,
    FormData
  >(updateDocumentSettingsAction, {});

  const saved = settings.color ?? defaultColor;
  const inSwatches = swatches.some((swatch) => swatch.color === saved);
  const [colorChoice, setColorChoice] = useState(inSwatches ? saved : "custom");
  const [customColor, setCustomColor] = useState(
    inSwatches ? defaultColor : saved,
  );
  const [font, setFont] = useState<DocumentFont>(settings.font);
  const [quoteIntro, setQuoteIntro] = useState(settings.quoteIntro ?? "");
  const [quoteTerms, setQuoteTerms] = useState(
    settings.quoteTerms ?? starters.quoteTerms,
  );
  const [invoiceIntro, setInvoiceIntro] = useState(settings.invoiceIntro ?? "");
  const [invoiceTerms, setInvoiceTerms] = useState(
    settings.invoiceTerms ?? starters.invoiceTerms,
  );
  const [footer, setFooter] = useState(settings.footer ?? "");
  const [iban, setIban] = useState(settings.iban ?? "");
  const [bic, setBic] = useState(settings.bic ?? "");
  const [kind, setKind] = useState<"quote" | "invoice">("quote");
  const ids = {
    colorHint: useId(),
    textsHint: useId(),
    ibanHint: useId(),
    custom: useId(),
  };

  const color = colorChoice === "custom" ? customColor : colorChoice;
  const adjusted =
    documentAppearance(color, font, defaultColor).accent !==
    color.toLowerCase();
  const model = sampleDocumentModel({
    kind,
    seller: {
      ...seller,
      document: {
        color,
        font,
        iban: iban.trim() || null,
        bic: bic.trim() || null,
        intro: (kind === "quote" ? quoteIntro : invoiceIntro).trim() || null,
        terms: (kind === "quote" ? quoteTerms : invoiceTerms).trim() || null,
        footer: footer.trim() || null,
      },
    },
    context,
    t: t as unknown as Translate,
    tQuotes: tQuotes as unknown as Translate,
    locale,
    defaultColor,
    logo: null,
    watermark: null,
  });

  return (
    <div className="documents-container">
      <div className="documents-layout">
        <form action={formAction} className="documents-form">
          <h2>{t("appearanceTitle")}</h2>
          <fieldset>
            <legend>{t("colorLegend")}</legend>
            <div className="swatch-list">
              {swatches.map((swatch) => (
                <label key={swatch.color} className="swatch-option">
                  <input
                    type="radio"
                    name="colorChoice"
                    value={swatch.color}
                    checked={colorChoice === swatch.color}
                    onChange={() => setColorChoice(swatch.color)}
                    aria-describedby={ids.colorHint}
                  />
                  <SwatchDot color={swatch.color} />
                  {swatch.label}
                </label>
              ))}
              <label className="swatch-option">
                <input
                  type="radio"
                  name="colorChoice"
                  value="custom"
                  checked={colorChoice === "custom"}
                  onChange={() => setColorChoice("custom")}
                  aria-describedby={ids.colorHint}
                />
                <SwatchDot color={customColor} />
                {t("colorCustom")}
              </label>
            </div>
            <label htmlFor={ids.custom}>{t("colorCustomField")}</label>
            <input
              id={ids.custom}
              type="color"
              name="customColor"
              value={customColor}
              onChange={(event) => {
                setCustomColor(event.target.value);
                setColorChoice("custom");
              }}
            />
            <p id={ids.colorHint} className="meta" aria-live="polite">
              {adjusted ? t("colorAdjusted") : t("colorReadable")}
            </p>
          </fieldset>

          <fieldset>
            <legend>{t("fontLegend")}</legend>
            {(["modern", "classic"] as const).map((value) => (
              <label key={value} className="radio-option">
                <input
                  type="radio"
                  name="font"
                  value={value}
                  checked={font === value}
                  onChange={() => setFont(value)}
                />
                {t(value === "modern" ? "fontModern" : "fontClassic")}
              </label>
            ))}
          </fieldset>

          <h2>{t("quoteTextsTitle")}</h2>
          <p id={ids.textsHint} className="meta">
            {t("textsHint")}
          </p>
          <label>
            {t("quoteIntro")}
            <textarea
              name="quoteIntro"
              rows={3}
              maxLength={limits.intro}
              value={quoteIntro}
              onChange={(event) => setQuoteIntro(event.target.value)}
            />
          </label>
          <label>
            {t("quoteTerms")}
            <textarea
              name="quoteTerms"
              rows={4}
              maxLength={limits.terms}
              aria-describedby={ids.textsHint}
              value={quoteTerms}
              onChange={(event) => setQuoteTerms(event.target.value)}
            />
          </label>

          <h2>{t("invoiceTextsTitle")}</h2>
          <label>
            {t("invoiceIntro")}
            <textarea
              name="invoiceIntro"
              rows={3}
              maxLength={limits.intro}
              value={invoiceIntro}
              onChange={(event) => setInvoiceIntro(event.target.value)}
            />
          </label>
          <label>
            {t("invoiceTerms")}
            <textarea
              name="invoiceTerms"
              rows={4}
              maxLength={limits.terms}
              aria-describedby={ids.textsHint}
              value={invoiceTerms}
              onChange={(event) => setInvoiceTerms(event.target.value)}
            />
          </label>
          <label>
            {t("footer")}
            <textarea
              name="footer"
              rows={2}
              maxLength={limits.intro}
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
            />
          </label>
          <p className="meta">{t("mandatoryHint")}</p>

          <h2>{t("paymentTitle")}</h2>
          <p id={ids.ibanHint} className="meta">
            {t("ibanHint")}
          </p>
          <label>
            {t("iban")}
            <input
              name="iban"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={ids.ibanHint}
              value={iban}
              onChange={(event) => setIban(event.target.value)}
            />
          </label>
          <label>
            {t("bic")}
            <input
              name="bic"
              autoComplete="off"
              spellCheck={false}
              value={bic}
              onChange={(event) => setBic(event.target.value)}
            />
          </label>

          <button type="submit" disabled={pending}>
            {t("save")}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("saved")}</p> : null}
        </form>

        <section
          className="documents-preview"
          aria-labelledby="documents-preview-title"
        >
          <div className="section-head">
            <h2 id="documents-preview-title">{t("previewTitle")}</h2>
            <div
              className="segmented"
              role="group"
              aria-label={t("previewTitle")}
            >
              <button
                type="button"
                aria-pressed={kind === "quote"}
                onClick={() => setKind("quote")}
              >
                {t("previewQuote")}
              </button>
              <button
                type="button"
                aria-pressed={kind === "invoice"}
                onClick={() => setKind("invoice")}
              >
                {t("previewInvoice")}
              </button>
            </div>
          </div>
          <p className="meta">{t("previewNote")}</p>
          <DocumentPreview
            model={model}
            logoUrl={logoUrl}
            label={t("previewLabel")}
          />
          <div className="toolbar">
            <a
              className="button-link"
              href="/devis/parametres/documents/exemple?type=devis"
            >
              {t("downloadQuote")}
            </a>
            <a
              className="button-link"
              href="/devis/parametres/documents/exemple?type=facture"
            >
              {t("downloadInvoice")}
            </a>
          </div>
          <p className="meta">{t("downloadHint")}</p>
        </section>
      </div>
    </div>
  );
}
