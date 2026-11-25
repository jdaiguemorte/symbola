"use client";

// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — « Reprendre les prestataires retenus
// (PDF) » : le PDF « Export des Prestataires » de l'ancien logiciel. L'écran de contrôle montre, pour
// chaque ligne du fichier, la fiche du carnet (retrouvée, ou à créer) et la ligne du budget où le
// prestataire sera retenu ; la planner corrige, écarte, puis confirme. Rien n'est écrit avant
// « Reprendre ». Même motif que l'import du programme (lot 63b).
import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { importEventVendorsAction, type EventVendorsImportState } from "./vendors-import-actions";

export function VendorsImportForm({ eventId, open = false }: { eventId: string; open?: boolean }) {
  const t = useTranslations("EventVendorsImport");
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState(importEventVendorsAction, {} as EventVendorsImportState);
  const result = state.result;
  // React vide le champ fichier après chaque action : le fichier choisi est gardé pour « Reprendre ».
  const file = useRef<File | null>(null);
  const run = (formData: FormData) => {
    const chosen = formData.get("file");
    if ((!(chosen instanceof File) || chosen.size === 0) && file.current) formData.set("file", file.current);
    return action(formData);
  };
  const preview = result?.status === "preview" ? result.preview : null;
  const kept = preview?.rows.filter((row) => !row.planner) ?? [];
  const toWrite = kept.filter((row) => !row.choice.skip && !row.alreadyRetained).length;
  return (
    <details className="program-import" id="reprendre-prestataires" open={open || undefined}>
      <summary>{t("title")}</summary>
      <p className="muted">{t("hint")}</p>
      <form action={run} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          {t("fileLabel")}
          <input type="file" name="file" onChange={(change) => (file.current = change.target.files?.[0] ?? null)} accept=".pdf,application/pdf" />
        </label>
        {preview ? (
          <>
            <h3>{t("previewTitle", { count: kept.length })}</h3>
            <p>
              {t("header", {
                clients: preview.header.clients.join(", ") || t("headerNoClients"),
                date: preview.header.eventDate ? formatCalendarDate(preview.header.eventDate, locale) : t("headerNoDate"),
              })}
            </p>
            {preview.header.check === "different" ? (
              <div role="alert" className="notice notice-attention">
                <p>{t("headerDifferent")}</p>
                <label>
                  <input type="checkbox" name="confirmHeader" value="1" />
                  {t("headerConfirm")}
                </label>
              </div>
            ) : null}
            {preview.rows.some((row) => row.planner) ? <p className="muted">{t("plannerSkipped", { names: preview.rows.filter((row) => row.planner).map((row) => row.name).join(", ") })}</p> : null}
            {/* NFR-19 : le tableau défile dans sa zone, la page ne déborde pas en 375 px. */}
            <div className="list-table-wrap" role="region" tabIndex={0} aria-label={t("previewTitle", { count: kept.length })}>
              <table className="data-table">
                <caption className="sr-only">{t("previewTitle", { count: kept.length })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("columnFile")}</th>
                    <th scope="col">{t("columnVendor")}</th>
                    <th scope="col">{t("columnSlot")}</th>
                    <th scope="col">{t("columnSkip")}</th>
                  </tr>
                </thead>
                <tbody>
                  {kept.map((row) => (
                    <tr key={row.line}>
                      <th scope="row">
                        <strong>{row.name}</strong>
                        <span className="meta"> · {[row.type, row.contact, row.email, row.phone].filter(Boolean).join(" · ")}</span>
                      </th>
                      <td>
                        <label className="sr-only" htmlFor={`vendor-${row.line}`}>
                          {t("chooseVendor", { name: row.name })}
                        </label>
                        <select id={`vendor-${row.line}`} name={`vendor-${row.line}`} defaultValue={row.choice.vendor}>
                          <option value="new">{row.typeLabel ? t("vendorNewTyped", { type: row.typeLabel }) : t("vendorNew")}</option>
                          {preview.carnet.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.city ? `${vendor.name} — ${vendor.city}` : vendor.name}
                            </option>
                          ))}
                        </select>
                        {row.vendor && row.choice.vendor === row.vendor.id ? <span className="badge">{t("vendorFound")}</span> : null}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`slot-${row.line}`}>
                          {t("chooseSlot", { name: row.name })}
                        </label>
                        <select id={`slot-${row.line}`} name={`slot-${row.line}`} defaultValue={row.choice.slot}>
                          <option value="new">{t("slotNew", { type: row.type })}</option>
                          {preview.slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.vendorNames.length > 0 ? `${slot.label} — ${slot.vendorNames.join(", ")}` : slot.label}
                            </option>
                          ))}
                        </select>
                        {row.alreadyRetained ? <span className="badge">{t("alreadyRetained")}</span> : null}
                      </td>
                      <td>
                        <input type="checkbox" name="skip" value={row.line} defaultChecked={row.choice.skip} aria-label={t("skipLine", { name: row.name })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">{t("applyHint")}</p>
            <button type="submit" name="intent" value="apply" className="primary" disabled={pending || kept.length === 0}>
              {t("apply", { count: toWrite })}
            </button>
          </>
        ) : null}
        <button type="submit" name="intent" value="preview" className="button-secondary" disabled={pending}>
          {preview ? t("refresh") : t("preview")}
        </button>
        {pending ? (
          <p role="status" className="muted">
            {t("reading")}
          </p>
        ) : null}
        {state.error ? <p role="alert">{state.error}</p> : null}
        {result?.status === "rejected" ? <p role="alert">{t(`rejected.${result.reason}`)}</p> : null}
        {result?.status === "applied" ? (
          <p role="status">
            {t("applied", { retained: result.retained, createdVendors: result.createdVendors, createdSlots: result.createdSlots })}
            {result.alreadyRetained > 0 ? ` ${t("appliedAlready", { count: result.alreadyRetained })}` : ""}
          </p>
        ) : null}
      </form>
    </details>
  );
}
