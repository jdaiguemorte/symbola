"use client";

// Lot 63c (DOC-01, BUD-04 ; maquette M8) — une seule zone de dépôt, toujours en tête des documents,
// même après le premier : glisser-déposer un fichier sur ordinateur, ou le choisir. Elle demande ce
// qu'est le document ; pour un devis ou une facture, le prestataire concerné (la pièce se rattache à
// sa ligne du budget) ; pour « autre », le dossier.
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RequiredMark } from "@/app/ui/required-mark";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";

export type DepositVendor = { candidateId: string; name: string; slotLabel: string };
type Kind = "vendor_quotes" | "vendor_invoices" | "contracts" | "other";
// « Autre » d'abord coché : le dépôt d'avant (dossier au choix, sinon « Divers ») reste le geste par défaut.
const KINDS: Kind[] = ["vendor_quotes", "vendor_invoices", "contracts", "other"];

export function DocumentDropZone({ eventId, vendors, folders, budgetEnabled }: { eventId: string; vendors: DepositVendor[]; folders: { id: string; name: string }[]; budgetEnabled: boolean }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useUploadAction<UploadState>(`/events/${eventId}/documents`);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>("other");
  const [candidateId, setCandidateId] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), vendor: useId(), folder: useId(), label: useId(), kinds: useId() };
  const forVendor = kind === "vendor_quotes" || kind === "vendor_invoices" || kind === "contracts";
  const vendor = vendors.find((entry) => entry.candidateId === candidateId) ?? null;

  // Après un dépôt réussi, la zone se vide pour la pièce suivante.
  useEffect(() => {
    if (!state.success) return;
    setFile(null);
    if (input.current) input.current.value = "";
  }, [state]);

  const submit = (formData: FormData) => {
    if (file) formData.set("file", file);
    action(formData);
  };

  return (
    <form action={submit} className="drop-zone-form" aria-labelledby={`${ids.file}-title`}>
      <div
        className={over ? "drop-zone drop-over" : "drop-zone"}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          setOver(false);
          setFile(event.dataTransfer.files[0] ?? null);
        }}
      >
        <p id={`${ids.file}-title`} className="drop-zone-title">
          {file ? t("dropChosen", { name: file.name }) : t("dropTitle")}
        </p>
        <label htmlFor={ids.file} className="button-link">
          {file ? t("dropChange") : t("dropChoose")}
        </label>
        <input
          ref={input}
          id={ids.file}
          type="file"
          className="sr-only"
          aria-label={t("file")}
          accept="application/pdf,image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="meta">{t("dropLimits")}</p>
      </div>

      <fieldset className="choice-row">
        <legend>
          {t("depositKindLegend")}
          <RequiredMark />
        </legend>
        {KINDS.map((entry) => (
          <label key={entry}>
            <input type="radio" name="kind" value={entry} checked={kind === entry} onChange={() => setKind(entry)} />
            {t(`depositKind.${entry}`)}
          </label>
        ))}
      </fieldset>

      {forVendor && vendors.length > 0 ? (
        <div className="stack">
          <label htmlFor={ids.vendor}>{kind === "contracts" ? t("depositVendorOptional") : t("depositVendor")}</label>
          <select id={ids.vendor} name="candidateId" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
            <option value="">{t("depositVendorNone")}</option>
            {vendors.map((entry) => (
              <option key={entry.candidateId} value={entry.candidateId}>
                {entry.name} ({entry.slotLabel})
              </option>
            ))}
          </select>
          {vendor && budgetEnabled ? <p className="meta">{t("depositOnLine", { line: vendor.slotLabel })}</p> : null}
        </div>
      ) : null}

      {kind === "other" && folders.length > 0 ? (
        <div className="stack">
          <label htmlFor={ids.folder}>{t("folder")}</label>
          <select id={ids.folder} name="folderId" defaultValue="">
            <option value="">{t("folderMisc")}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!(forVendor && vendor && budgetEnabled) ? (
        <div className="stack">
          <label htmlFor={ids.label}>{t("label")}</label>
          <input id={ids.label} type="text" name="label" maxLength={200} placeholder={t("labelPlaceholder")} />
        </div>
      ) : null}

      <button type="submit" className="button-primary" disabled={pending || !file}>
        {t("attach")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.message ?? t("attached")}</p> : null}
    </form>
  );
}
