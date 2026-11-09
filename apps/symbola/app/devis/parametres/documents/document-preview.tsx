"use client";

// Lot 17 (DEV-09) — aperçu HTML d'un devis ou d'une facture, à partir du même
// modèle que le PDF (un PDF ne s'affiche pas dans la page : X-Frame-Options et
// CSP). Les couleurs passent par des variables CSS posées après le rendu
// (CSSOM) : la CSP refuse les attributs style du HTML rendu côté serveur.
import { useLayoutEffect, useRef } from "react";
import type { QuotePdfModel } from "../../[quoteId]/quote-pdf-model";

export function DocumentPreview({ model, logoUrl, label }: { model: QuotePdfModel; logoUrl: string | null; label: string }) {
  const sheet = useRef<HTMLElement>(null);
  const { accent, onAccent, tint, font } = model.appearance;

  useLayoutEffect(() => {
    const element = sheet.current;
    if (!element) return;
    element.style.setProperty("--doc", accent);
    element.style.setProperty("--doc-ink", onAccent);
    element.style.setProperty("--doc-tint", tint);
  }, [accent, onAccent, tint]);

  const lastStrong = model.totals.map((total) => Boolean(total.strong)).lastIndexOf(true);
  const mentions = [model.legalMention, model.terms].filter((text): text is string => Boolean(text)).join("\n");
  const footer = [model.footer.text, model.footer.legal].filter(Boolean).join("\n");

  return (
    <div className="doc-frame" tabIndex={0} role="region" aria-label={label}>
      <article ref={sheet} className={font === "classic" ? "doc-sheet doc-classic" : "doc-sheet"}>
        <div className="doc-head">
          <div>{logoUrl ? <img className="doc-logo" src={logoUrl} alt="" /> : <p className="doc-name">{model.seller.name}</p>}</div>
          <div className="doc-title">
            <p className="doc-kind">{model.kind}</p>
            <p className="doc-number">{model.number}</p>
            {model.subtitle ? <p className="doc-sub">{model.subtitle}</p> : null}
          </div>
        </div>

        <div className="doc-parties">
          {[model.seller, model.client].map((party, index) => (
            <div key={party.heading} className="doc-party">
              <p className="doc-label">{party.heading}</p>
              {index === 0 ? <p className="doc-strong">{model.seller.name}</p> : null}
              {party.lines.map((line, lineIndex) => (
                <p key={`${lineIndex}-${line}`} className={index === 1 && lineIndex === 0 ? "doc-strong" : undefined}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>

        {model.dates.length > 0 ? (
          <div className="doc-dates">
            {model.dates.map((date) => (
              <p key={date.label}>
                <span>{date.label}</span>
                {date.value}
              </p>
            ))}
          </div>
        ) : null}

        {model.intro ? <p className="doc-intro">{model.intro}</p> : null}

        <table className="doc-table">
          <thead>
            <tr>
              {model.columns.map((column, index) => (
                <th key={column} scope="col" className={index === 0 ? undefined : "num"}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, index) => (
                  <td key={index} className={index === 0 ? undefined : "num"}>
                    {cell}
                    {index === 0 && row.description ? <span className="doc-desc">{row.description}</span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-bottom">
          {model.payment ? (
            <div className="doc-pay">
              <p className="doc-label">{model.payment.title}</p>
              {model.payment.lines.map((line) => (
                <p key={line.label} className={line.amount ? "doc-pay-row" : undefined}>
                  <span>{line.label}</span>
                  {line.amount ? <span>{line.amount}</span> : null}
                </p>
              ))}
            </div>
          ) : (
            <div />
          )}
          <div className="doc-totals">
            {model.totals.map((total, index) => (
              <p key={total.label} className={index === lastStrong ? "doc-total doc-due" : total.strong ? "doc-total doc-strong" : "doc-total"}>
                <span>{total.label}</span>
                <span>{total.value}</span>
              </p>
            ))}
          </div>
        </div>

        {mentions ? <p className="doc-mentions">{mentions}</p> : null}

        <div className="doc-foot">
          <span>{footer}</span>
          <span>{model.footer.page.replace("{page}", "1").replace("{total}", "1")}</span>
        </div>
      </article>
    </div>
  );
}
