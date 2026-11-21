// Lot 37a (DOC-01, DOC-04, POR-10 ; D2 à D7 ; ADR 0070) — onglet « Documents » de la fiche : un
// seul espace par évènement. Les documents déposés par l'équipe, rangés dans ses dossiers (un
// niveau, « Divers » sans dossier), avec leurs versions, leur partage et leurs liens à durée
// limitée ; puis, en lecture, les pièces des modules dans leurs dossiers fixes. Chaque pièce
// s'aperçoit dans un onglet du navigateur, sans téléchargement (« ?apercu=1 ») : l'app refuse
// d'être encadrée (X-Frame-Options DENY), il n'y a donc pas d'aperçu dans un cadre.
// Lot 63c (DOC-01, BUD-04 ; maquette M8) : une seule zone de dépôt, toujours en tête, qui demande ce
// qu'est le document ; les dossiers typés (« Devis des prestataires », « Factures des prestataires »,
// « Contrats ») montrent aussi les pièces des lignes du budget ; « Déplacer vers… » sur chaque pièce,
// et le glisser-déposer sur ordinateur. « Mes devis » et « Mes factures » restent en lecture.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/app/ui/empty-state";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import type { EventDocument, EventDocumentFolder, EventDocumentShareLink, EventDocumentVersion } from "@symbola/contracts";
import { DOCUMENT_LINK_MAX_DAYS, DOCUMENT_LINK_MIN_DAYS, listEventDocumentFolders, listEventDocumentLinksOfEvent, listEventDocumentVersionsOfEvent, listEventVendorSlots, listTypedDocumentFolders, listVendorCandidates } from "@/modules/events/service";
import { listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { DocumentDropZone } from "./document-drop-zone";
import { DraggablePiece, FolderDrop, MoveToMenu, PiecesProvider } from "./document-pieces";
import type { FolderTarget, PieceRef } from "./document-targets";
import { previewPath } from "@/lib/file-response";
import { listModuleDocumentFolders, type ModuleDocument } from "./document-sources";
import {
  DocumentFolderCreateForm,
  DocumentFolderRenameForm,
  DocumentLinkCreateForm,
  DocumentSharingForm,
  DocumentVersionUploadForm,
  EventDocumentRenameForm,
} from "./document-forms";
import { removeDocumentFolderAction, removeEventDocumentAction, revokeDocumentLinkAction } from "./document-actions";

type Props = {
  eventId: string;
  organizationId: string;
  locale: Locale;
  documents: EventDocument[];
  embeddedDocumentIds: Set<string>;
  dayOfOpen: boolean;
};

function linkState(link: EventDocumentShareLink, now: Date): "active" | "expired" | "revoked" {
  if (link.revokedAt) return "revoked";
  return new Date(link.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}

export async function DocumentsTab({ eventId, organizationId, locale, documents, embeddedDocumentIds, dayOfOpen }: Props) {
  const t = await getTranslations("EventDocuments");
  const tBudget = await getTranslations("Budget");
  const budgetEnabled = await isBudgetModuleEnabled(organizationId);
  const [folders, versions, links, moduleFolders, typedFolders, candidates, slots, budget] = await Promise.all([
    listEventDocumentFolders(organizationId, eventId),
    listEventDocumentVersionsOfEvent(organizationId, eventId),
    listEventDocumentLinksOfEvent(organizationId, eventId),
    listModuleDocumentFolders(organizationId, eventId),
    listTypedDocumentFolders(organizationId, eventId, locale === "en" ? "en" : "fr"),
    listVendorCandidates(organizationId, eventId),
    listEventVendorSlots(organizationId, eventId),
    budgetEnabled ? listBudgetLines(organizationId, eventId) : Promise.resolve(null),
  ]);
  const now = new Date();
  const versionsOf = new Map<string, EventDocumentVersion[]>();
  for (const version of versions) versionsOf.set(version.documentId, [...(versionsOf.get(version.documentId) ?? []), version]);
  const linksOf = new Map<string, EventDocumentShareLink[]>();
  for (const link of links) linksOf.set(link.documentId, [...(linksOf.get(link.documentId) ?? []), link]);
  const slotLabel = new Map(slots.map((slot) => [slot.id, slot.label]));
  // Les prestataires de l'évènement, pour « Prestataire concerné » (les écartés exceptés).
  const depositVendors = candidates.filter((candidate) => candidate.status !== "dismissed").map((candidate) => ({ candidateId: candidate.id, name: candidate.vendorName, slotLabel: slotLabel.get(candidate.vendorSlotId) ?? "" }));
  // Les pièces des lignes du budget, rangées par nature dans les dossiers typés.
  const budgetPieces = (budget?.lines ?? []).flatMap((line) => line.attachments.map((attachment) => ({ attachment, line })));

  // Les dossiers : les typés d'abord (fichier de données), puis ceux de l'équipe, puis « Divers ».
  const typedFolderIds = new Set(typedFolders.flatMap((typed) => (typed.folderId ? [typed.folderId] : [])));
  const groups: { target: FolderTarget; folder: EventDocumentFolder | null; documents: EventDocument[]; pieces: typeof budgetPieces }[] = [
    ...typedFolders
      .map((typed) => ({
        target: { key: typed.key, name: typed.name, folderId: typed.folderId, budgetKind: typed.kind, virtual: typed.folderId === null },
        folder: folders.find((folder) => folder.id === typed.folderId) ?? null,
        documents: typed.folderId ? documents.filter((document) => document.folderId === typed.folderId) : [],
        pieces: budgetPieces.filter((piece) => piece.attachment.kind === typed.kind),
      }))
      // Avec le module Budget, les trois dossiers typés se montrent toujours (M8) : une pièce de ligne
      // peut y aller même si l'équipe n'a pas (ou plus) le dossier ; sans lui, seulement ceux de l'équipe.
      .filter((group) => !group.target.virtual || budgetEnabled),
    ...folders
      .filter((folder) => !typedFolderIds.has(folder.id))
      .map((folder) => ({ target: { key: folder.id, name: folder.name, folderId: folder.id, budgetKind: null, virtual: false }, folder, documents: documents.filter((document) => document.folderId === folder.id), pieces: [] })),
    {
      target: { key: "misc", name: t("folderMisc"), folderId: null, budgetKind: null, virtual: false },
      folder: null,
      documents: documents.filter((document) => document.folderId === null || !folders.some((folder) => folder.id === document.folderId)),
      pieces: [],
    },
  ];
  const folderOptions = folders.map((folder) => ({ id: folder.id, name: folder.name }));
  // Mes devis, mes factures et les autres pièces des modules, en lecture ; les pièces du budget sont
  // dans les dossiers typés.
  const readOnlyFolders = moduleFolders.filter((folder) => folder.key !== "budget");

  const fileLinks = (path: string, label: string) => (
    <p className="document-links">
      <a href={previewPath(path)} target="_blank" rel="noopener noreferrer" aria-label={t("previewLabel", { label })}>
        {t("preview")}
      </a>
      <a href={path} download aria-label={t("downloadLabel", { label })}>
        {t("download")}
      </a>
    </p>
  );

  const sharingNote = (document: EventDocument) =>
    document.sharedWithClients && document.sharedWithVendors
      ? t("sharedBoth")
      : document.sharedWithClients
        ? t("sharedClients")
        : document.sharedWithVendors
          ? t("sharedVendors")
          : t("sharedNobody");

  const moduleItem = (document: ModuleDocument) => (
    <li key={document.key}>
      <div>
        <strong>{document.label}</strong>
        <p className="meta">{[document.detail, document.sizeBytes !== null ? formatFileSize(document.sizeBytes, locale) : null].filter(Boolean).join(" · ")}</p>
      </div>
      {fileLinks(document.path, document.label)}
    </li>
  );

  const teamPiece = (document: EventDocument) => {
    const documentVersions = versionsOf.get(document.id) ?? [];
    const documentLinks = linksOf.get(document.id) ?? [];
    const base = `/events/${eventId}/documents/${document.id}`;
    const piece: PieceRef = { type: "team", id: document.id, label: document.label, folderId: document.folderId };
    return (
      <DraggablePiece key={document.id} piece={piece}>
        <div>
          <strong>{document.label}</strong>
          <p className="meta">
            {[t("versionNumber", { version: document.version }), formatFileSize(document.sizeBytes, locale), sharingNote(document), embeddedDocumentIds.has(document.id) ? t("embedded") : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {fileLinks(base, document.label)}
        <MoveToMenu piece={piece} />
        <details className="document-manage">
          <summary>{t("manageLabel", { label: document.label })}</summary>
          <DocumentSharingForm eventId={eventId} documentId={document.id} label={document.label} clients={document.sharedWithClients} vendors={document.sharedWithVendors} />
          <DocumentVersionUploadForm eventId={eventId} documentId={document.id} label={document.label} />
          {documentVersions.length > 1 ? (
            <section aria-label={t("versionsTitle", { label: document.label })}>
              <h4>{t("versionsHeading")}</h4>
              <ul className="document-versions">
                {documentVersions.map((version) => (
                  <li key={version.id}>
                    <span>
                      {t("versionLine", { version: version.version, date: formatDateTime(new Date(version.createdAt), locale), size: formatFileSize(version.sizeBytes, locale) })}
                      {version.version === document.version ? ` · ${t("versionCurrent")}` : ""}
                    </span>
                    {fileLinks(`${base}?version=${version.version}`, t("versionOf", { label: document.label, version: version.version }))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label={t("linksTitle", { label: document.label })}>
            <h4>{t("linksHeading")}</h4>
            <p className="meta">{t("linksHint")}</p>
            {documentLinks.length > 0 ? (
              <ul className="document-links-list">
                {documentLinks.map((link) => {
                  const state = linkState(link, now);
                  return (
                    <li key={link.id}>
                      <span>
                        {state === "active"
                          ? t("linkActive", { date: formatDateTime(new Date(link.expiresAt), locale) })
                          : state === "expired"
                            ? t("linkExpired", { date: formatDateTime(new Date(link.expiresAt), locale) })
                            : t("linkRevoked")}
                        {" · "}
                        {link.lastOpenedAt ? t("linkOpenedAt", { count: link.openCount, date: formatDateTime(new Date(link.lastOpenedAt), locale) }) : t("linkNeverOpened")}
                      </span>
                      {state === "active" ? (
                        <form action={revokeDocumentLinkAction}>
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="linkId" value={link.id} />
                          <button type="submit" className="button-ghost">
                            {t("revokeLink")}
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <DocumentLinkCreateForm eventId={eventId} documentId={document.id} label={document.label} minDays={DOCUMENT_LINK_MIN_DAYS} maxDays={DOCUMENT_LINK_MAX_DAYS} />
          </section>
          <EventDocumentRenameForm eventId={eventId} documentId={document.id} label={document.label} />
          <form action={removeEventDocumentAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="documentId" value={document.id} />
            <button type="submit" className="button-ghost" aria-label={t("removeLabel", { label: document.label })}>
              {t("remove")}
            </button>
          </form>
        </details>
      </DraggablePiece>
    );
  };

  const budgetPiece = ({ attachment, line }: (typeof budgetPieces)[number]) => {
    const label = [line.label, line.vendorName].filter(Boolean).join(" · ");
    const piece: PieceRef = { type: "budget", id: attachment.id, label, kind: attachment.kind };
    return (
      <DraggablePiece key={attachment.id} piece={piece}>
        <div>
          <strong>{label}</strong>
          <p className="meta">{[tBudget(`documentKind.${attachment.kind}`), formatFileSize(attachment.sizeBytes, locale), t("onBudgetLine", { line: line.label })].join(" · ")}</p>
        </div>
        {fileLinks(`/budget/${eventId}/devis/${attachment.id}`, label)}
        <MoveToMenu piece={piece} />
      </DraggablePiece>
    );
  };

  return (
    <section className="card" aria-labelledby="event-documents-title">
      <div className="section-head">
        <h2 id="event-documents-title">{t("title")}</h2>
        {/* Lot 63c (#30) : l'aide mène à l'article des documents, pas à la liste des tutoriels. */}
        <Link href="/aide/ecrans/eventDocuments">{t("helpLink")}</Link>
      </div>
      <p>{t("intro")}</p>

      <div id="deposer-un-document">
        <DocumentDropZone eventId={eventId} vendors={depositVendors} folders={folderOptions} budgetEnabled={budgetEnabled} />
      </div>

      {documents.length === 0 && budgetPieces.length === 0 ? <EmptyState screen="documents" title={t("empty")} actionHref="#deposer-un-document" helpHref="/aide/ecrans/eventDocuments" /> : null}
      <PiecesProvider eventId={eventId} targets={groups.map((group) => group.target)}>
        <p className="meta">{t("dragHelp")}</p>
        {groups.map((group) => {
          const headingId = `documents-folder-${group.target.key}`;
          const count = group.documents.length + group.pieces.length;
          return (
            <FolderDrop key={group.target.key} target={group.target} headingId={headingId} className="document-folder">
              <h3 id={headingId}>
                {group.target.name} <span className="badge" aria-hidden="true">{count}</span>
              </h3>
              {count === 0 ? <p className="meta">{t("folderEmpty")}</p> : null}
              <ul className="item-list event-documents">
                {group.pieces.map(budgetPiece)}
                {group.documents.map(teamPiece)}
              </ul>
            </FolderDrop>
          );
        })}
      </PiecesProvider>

      <details className="document-folders">
        <summary>{t("foldersTitle", { count: folders.length })}</summary>
        <p className="meta">{t("foldersHint")}</p>
        <DocumentFolderCreateForm eventId={eventId} />
        {folders.length > 0 ? (
          <ul className="item-list">
            {folders.map((folder) => (
              <li key={folder.id}>
                <DocumentFolderRenameForm eventId={eventId} folderId={folder.id} name={folder.name} />
                <form action={removeDocumentFolderAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="folderId" value={folder.id} />
                  <button type="submit" className="button-ghost" aria-label={t("folderRemoveLabel", { name: folder.name })}>
                    {t("folderRemove")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      <h3>{t("moduleTitle")}</h3>
      <p className="meta">{t("moduleHint")}</p>
      {readOnlyFolders.map((folder) => (
        <section key={folder.key} aria-labelledby={`documents-module-${folder.key}`} className="document-folder">
          <h4 id={`documents-module-${folder.key}`}>
            {folder.title} <span className="badge">{t("readOnly")}</span>
          </h4>
          {folder.documents.length === 0 ? <p className="meta">{t("folderEmpty")}</p> : <ul className="item-list event-documents">{folder.documents.map(moduleItem)}</ul>}
        </section>
      ))}

      {dayOfOpen ? (
        <p>
          <a href={`/jour-j/${eventId}#documents`}>{t("chooseForDayOf")}</a>
        </p>
      ) : (
        <p className="meta">{t("dayOfLater")}</p>
      )}
    </section>
  );
}
