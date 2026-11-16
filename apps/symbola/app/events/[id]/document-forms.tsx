"use client";

// Lot 29b (JRJ-04, décision D8) — envoi d'un document de l'événement et renommage.
// Lot 37a (DOC-01, DOC-04, POR-10 ; D3, D4, D6, D7) : dossier au dépôt, nouvelle version, rangement,
// partage avec les clients et les prestataires, dossiers, lien de partage à durée limitée.
import { useActionState, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTime, type Locale } from "@symbola/i18n";
import type { EventDocumentFolder } from "@symbola/contracts";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import {
  createDocumentFolderAction,
  createDocumentLinkAction,
  moveDocumentAction,
  renameDocumentFolderAction,
  renameEventDocumentAction,
  setDocumentSharingAction,
  type DocumentLinkFormState,
  type EventDocumentFormState,
} from "./document-actions";

type FolderOption = Pick<EventDocumentFolder, "id" | "name">;

function FolderSelect({ id, folders, defaultValue }: { id: string; folders: FolderOption[]; defaultValue: string | null }) {
  const t = useTranslations("EventDocuments");
  return (
    <select id={id} name="folderId" defaultValue={defaultValue ?? ""}>
      <option value="">{t("folderMisc")}</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.name}
        </option>
      ))}
    </select>
  );
}

export function EventDocumentUploadForm({ eventId, folders = [] }: { eventId: string; folders?: FolderOption[] }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useUploadAction<UploadState>(`/events/${eventId}/documents`);
  const ids = { label: useId(), file: useId(), folder: useId() };
  return (
    <form action={action} className="stack">
      <label htmlFor={ids.label}>{t("label")}</label>
      <input id={ids.label} type="text" name="label" maxLength={200} placeholder={t("labelPlaceholder")} />
      {folders.length > 0 ? (
        <>
          <label htmlFor={ids.folder}>{t("folder")}</label>
          <FolderSelect id={ids.folder} folders={folders} defaultValue={null} />
        </>
      ) : null}
      <label htmlFor={ids.file}>{t("file")}</label>
      <input id={ids.file} type="file" name="file" accept="application/pdf,image/*" required />
      <button type="submit" disabled={pending}>
        {t("attach")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("attached")}</p> : null}
    </form>
  );
}

export function EventDocumentRenameForm({ eventId, documentId, label }: { eventId: string; documentId: string; label: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(renameEventDocumentAction, {} as EventDocumentFormState);
  const id = useId();
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor={id} className="sr-only">
        {t("renameLabel", { label })}
      </label>
      <input id={id} type="text" name="label" defaultValue={label} maxLength={200} required />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("rename")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("renamed")}</p> : null}
    </form>
  );
}

// D4 : la nouvelle version devient le fichier du document ; les précédentes restent.
export function DocumentVersionUploadForm({ eventId, documentId, label }: { eventId: string; documentId: string; label: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useUploadAction<UploadState>(`/events/${eventId}/documents/${documentId}`);
  const id = useId();
  return (
    <form action={action} className="stack">
      <label htmlFor={id}>{t("newVersionLabel", { label })}</label>
      <input id={id} type="file" name="file" accept="application/pdf,image/*" required />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("newVersion")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("versionAdded")}</p> : null}
    </form>
  );
}

export function DocumentMoveForm({ eventId, documentId, label, folderId, folders }: { eventId: string; documentId: string; label: string; folderId: string | null; folders: FolderOption[] }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(moveDocumentAction, {} as EventDocumentFormState);
  const id = useId();
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor={id}>{t("moveLabel", { label })}</label>
      <FolderSelect id={id} folders={folders} defaultValue={folderId} />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("move")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("moved")}</p> : null}
    </form>
  );
}

// D6, POR-10 : rien n'est partagé par défaut ; la planner coche, puis enregistre.
export function DocumentSharingForm({ eventId, documentId, label, clients, vendors }: { eventId: string; documentId: string; label: string; clients: boolean; vendors: boolean }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(setDocumentSharingAction, {} as EventDocumentFormState);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="documentId" value={documentId} />
      <fieldset>
        <legend>{t("sharingLegend", { label })}</legend>
        <label>
          <input type="checkbox" name="clients" defaultChecked={clients} /> {t("shareClients")}
        </label>
        <label>
          <input type="checkbox" name="vendors" defaultChecked={vendors} /> {t("shareVendors")}
        </label>
      </fieldset>
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("saveSharing")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("sharingSaved")}</p> : null}
    </form>
  );
}

// D7 : un lien de 1 à 30 jours ; son adresse ne se montre qu'ici, une fois.
export function DocumentLinkCreateForm({ eventId, documentId, label, minDays, maxDays }: { eventId: string; documentId: string; label: string; minDays: number; maxDays: number }) {
  const t = useTranslations("EventDocuments");
  const tEvents = useTranslations("Events");
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState(createDocumentLinkAction, {} as DocumentLinkFormState);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const ids = { days: useId(), hint: useId() };
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor={ids.days}>{t("linkDaysLabel", { label })}</label>
      <input id={ids.days} type="number" name="days" min={minDays} max={maxDays} step={1} defaultValue={7} required aria-describedby={ids.hint} />
      <p id={ids.hint} className="meta">
        {t("linkDaysHint", { min: minDays, max: maxDays })}
      </p>
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("createLink")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success && state.url ? (
        <div className="link-delivered" role="status">
          <p>{t("linkCreated", { date: state.expiresAt ? formatDateTime(new Date(state.expiresAt), locale) : "" })}</p>
          <label>
            {t("linkUrlLabel")}
            <input type="text" readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.url!);
                setCopy("copied");
              } catch {
                setCopy("failed");
              }
            }}
          >
            {tEvents("copyLink")}
          </button>
          <span className="meta">{copy === "copied" ? tEvents("linkCopied") : copy === "failed" ? tEvents("linkCopyFailed") : ""}</span>
          <p className="muted">{t("linkUrlOnce")}</p>
        </div>
      ) : null}
    </form>
  );
}

export function DocumentFolderCreateForm({ eventId }: { eventId: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(createDocumentFolderAction, {} as EventDocumentFormState);
  const id = useId();
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor={id}>{t("folderName")}</label>
      <input id={id} type="text" name="name" maxLength={80} required placeholder={t("folderPlaceholder")} />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("createFolder")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("folderCreated")}</p> : null}
    </form>
  );
}

export function DocumentFolderRenameForm({ eventId, folderId, name }: { eventId: string; folderId: string; name: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(renameDocumentFolderAction, {} as EventDocumentFormState);
  const id = useId();
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="folderId" value={folderId} />
      <label htmlFor={id} className="sr-only">
        {t("folderRenameLabel", { name })}
      </label>
      <input id={id} type="text" name="name" defaultValue={name} maxLength={80} required />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("rename")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("folderRenamed")}</p> : null}
    </form>
  );
}
