"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { SearchTerms } from "./actions";
import { executeErasureAction, type ErasureExecuteState, type ErasurePreviewState } from "./erasure-actions";

export type ErasableRequest = { id: string; label: string };

// RGPD-03 — aperçu de l'oubli (supprimée, anonymisée, conservée avec motif
// légal et date de fin), puis validation rattachée à la demande d'oubli.
export function ErasurePreview({ preview, terms, erasureRequests }: { preview: ErasurePreviewState; terms: SearchTerms; erasureRequests: ErasableRequest[] }) {
  const t = useTranslations("Privacy");
  const locale = useLocale() as Locale;
  const initialState: ErasureExecuteState = {};
  const [state, executeAction, executing] = useActionState(executeErasureAction, initialState);
  const items = preview.items ?? [];

  return (
    <section aria-labelledby="privacy-erasure">
      <h2 id="privacy-erasure">{t("erasureTitle")}</h2>
      <p>{t("erasureIntro", { count: items.length })}</p>
      <ul>
        {items.map((item) => (
          <li key={`${item.module}:${item.kind}:${item.recordId}`}>
            <strong>{t(`fate.${item.fate}`)}</strong> — {t(`module.${item.module}`)} · {t(`kind.${item.kind}`)}
            {item.label ? ` : ${item.label}` : ""}
            {item.fate === "kept" && item.legalBasis && item.keptUntil ? (
              <>
                {" "}
                <small>({t("keptReason", { basis: t(`legalBasis.${item.legalBasis}`), date: formatCalendarDate(item.keptUntil, locale) })})</small>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <form action={executeAction}>
        {terms.email ? <input type="hidden" name="email" value={terms.email} /> : null}
        {terms.phone ? <input type="hidden" name="phone" value={terms.phone} /> : null}
        {terms.name ? <input type="hidden" name="name" value={terms.name} /> : null}
        {(preview.selectedKeys ?? []).map((key) => (
          <input key={key} type="hidden" name="record" value={key} />
        ))}
        {erasureRequests.length === 0 ? (
          <p role="note">{t("erasureNoRequest")}</p>
        ) : (
          <>
            <label>
              {t("erasureRequestLabel")}
              <select name="requestId" required defaultValue="">
                <option value="" disabled>
                  {t("erasureChooseRequest")}
                </option>
                {erasureRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" name="irreversibleAcknowledged" required /> {t("erasureConfirm")}
            </label>
            <button type="submit" disabled={executing}>
              {executing ? t("erasing") : t("erasureSubmit")}
            </button>
          </>
        )}
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
    </section>
  );
}
