"use client";

// Lot 38a (MSG-01, HUB-18 ; D4, D7 ; ADR 0072) — l'aperçu d'un e-mail dans la page, à partir de la
// même mise en page que l'e-mail envoyé : logo (servi par l'app, pas de pièce jointe dans une page)
// ou nom, couleur des documents, paragraphes et bouton, coordonnées en pied. Les couleurs passent
// par des variables CSS posées après le rendu (CSSOM) : la CSP refuse les attributs style.
import { useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { EmailPreview } from "@/modules/hub/service";

export function EmailPreviewView({ preview, logoUrl }: { preview: EmailPreview; logoUrl: string | null }) {
  const t = useTranslations("EmailTemplates");
  const card = useRef<HTMLDivElement>(null);
  const { layout } = preview;

  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    element.style.setProperty("--mail-accent", layout.accent);
    element.style.setProperty("--mail-on-accent", layout.textOnAccent);
  }, [layout.accent, layout.textOnAccent]);

  return (
    <div className="mail-preview" role="region" aria-label={t("previewLabel")} tabIndex={0}>
      <p className="meta">{t("previewFrom", { name: layout.senderName })}</p>
      <p className="meta">{preview.replyTo ? t("previewReplyTo", { email: preview.replyTo }) : t("previewNoReplyTo")}</p>
      <p className="mail-preview-subject">{t("previewSubject", { subject: layout.subject })}</p>
      {preview.missingTokens.length > 0 ? <p role="alert">{t("previewMissing", { tokens: preview.missingTokens.join(", ") })}</p> : null}
      <div ref={card} className="mail-preview-card">
        <div className="mail-preview-head">
          {logoUrl && preview.hasLogo ? <img className="mail-preview-logo" src={logoUrl} alt={layout.senderName} /> : <p className="mail-preview-name">{layout.senderName}</p>}
        </div>
        <div className="mail-preview-body">
          {layout.blocks.map((block, index) =>
            block.kind === "paragraph" ? (
              <p key={index}>{block.text}</p>
            ) : (
              <div key={index}>
                <span className="mail-preview-button">{block.label}</span>
                <p className="mail-preview-url">{block.url}</p>
              </div>
            ),
          )}
        </div>
        <div className="mail-preview-foot">
          {layout.footerLines.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
          <p className="muted">{layout.footerNote}</p>
        </div>
      </div>
    </div>
  );
}
