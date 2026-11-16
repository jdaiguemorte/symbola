// Lot 37a (DOC-01, DOC-04, POR-10 ; D2 à D7 ; ADR 0070) — onglet « Documents » de la fiche : un
// seul espace par évènement. Les documents déposés par l'équipe, rangés dans ses dossiers (un
// niveau, « Divers » sans dossier), avec leurs versions, leur partage et leurs liens à durée
// limitée ; puis, en lecture, les pièces des modules dans leurs dossiers fixes. Chaque pièce
// s'aperçoit dans un onglet du navigateur, sans téléchargement (« ?apercu=1 ») : l'app refuse
// d'être encadrée (X-Frame-Options DENY), il n'y a donc pas d'aperçu dans un cadre.
import { getTranslations } from "next-intl/server";
import { formatDateTime, formatFileSize, type Locale } from "@symbola/i18n";
import type { EventDocument, EventDocumentFolder, EventDocumentShareLink, EventDocumentVersion } from "@symbola/contracts";
import { DOCUMENT_LINK_MAX_DAYS, DOCUMENT_LINK_MIN_DAYS, listEventDocumentFolders, listEventDocumentLinksOfEvent, listEventDocumentVersionsOfEvent } from "@/modules/events/service";
import { previewPath } from "@/lib/file-response";
import { listModuleDocumentFolders, type ModuleDocument } from "./document-sources";
import {
  DocumentFolderCreateForm,
  DocumentFolderRenameForm,
  DocumentLinkCreateForm,
  DocumentMoveForm,
  DocumentSharingForm,
  DocumentVersionUploadForm,
  EventDocumentRenameForm,
  EventDocumentUploadForm,
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
  const [folders, versions, links, moduleFolders] = await Promise.all([
    listEventDocumentFolders(organizationId, eventId),
    listEventDocumentVersionsOfEvent(organizationId, eventId),
    listEventDocumentLinksOfEvent(organizationId, eventId),
    listModuleDocumentFolders(organizationId, eventId),
  ]);
  const now = new Date();
  const versionsOf = new Map<string, EventDocumentVersion[]>();
  for (const version of versions) versionsOf.set(version.documentId, [...(versionsOf.get(version.documentId) ?? []), version]);
  const linksOf = new Map<string, EventDocumentShareLink[]>();
  for (const link of links) linksOf.set(link.documentId, [...(linksOf.get(link.documentId) ?? []), link]);
  const folderOptions = folders.map((folder) => ({ id: folder.id, name: folder.name }));
  // Dossiers de l'équipe (par nom), puis « Divers » ; un dossier vide se montre, pour s'y ranger.
  const groups: { folder: EventDocumentFolder | null; documents: EventDocument[] }[] = [
    ...folders.map((folder) => ({ folder, documents: documents.filter((document) => document.folderId === folder.id) })),
    { folder: null, documents: documents.filter((document) => document.folderId === null || !folders.some((folder) => folder.id === document.folderId)) },
  ];

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

  return (
    <section className="card" aria-labelledby="event-documents-title">
      <h2 id="event-documents-title">{t("title")}</h2>
      <p>{t("intro")}</p>

      <h3>{t("addTitle")}</h3>
      <EventDocumentUploadForm eventId={eventId} folders={folderOptions} />

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

      {documents.length === 0 ? <p>{t("empty")}</p> : null}
      {groups
        .filter((group) => group.folder !== null || group.documents.length > 0)
        .map((group) => {
          const headingId = `documents-folder-${group.folder?.id ?? "misc"}`;
          return (
            <section key={group.folder?.id ?? "misc"} aria-labelledby={headingId} className="document-folder">
              <h3 id={headingId}>{group.folder?.name ?? t("folderMisc")}</h3>
              {group.documents.length === 0 ? <p className="meta">{t("folderEmpty")}</p> : null}
              <ul className="item-list event-documents">
                {group.documents.map((document) => {
                  const documentVersions = versionsOf.get(document.id) ?? [];
                  const documentLinks = linksOf.get(document.id) ?? [];
                  const base = `/events/${eventId}/documents/${document.id}`;
                  return (
                    <li key={document.id}>
                      <div>
                        <strong>{document.label}</strong>
                        <p className="meta">
                          {[
                            t("versionNumber", { version: document.version }),
                            formatFileSize(document.sizeBytes, locale),
                            sharingNote(document),
                            embeddedDocumentIds.has(document.id) ? t("embedded") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {fileLinks(base, document.label)}
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
                        <DocumentMoveForm eventId={eventId} documentId={document.id} label={document.label} folderId={document.folderId} folders={folderOptions} />
                        <EventDocumentRenameForm eventId={eventId} documentId={document.id} label={document.label} />
                        <form action={removeEventDocumentAction}>
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="documentId" value={document.id} />
                          <button type="submit" className="button-ghost" aria-label={t("removeLabel", { label: document.label })}>
                            {t("remove")}
                          </button>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

      <h3>{t("moduleTitle")}</h3>
      <p className="meta">{t("moduleHint")}</p>
      {moduleFolders.map((folder) => (
        <section key={folder.key} aria-labelledby={`documents-module-${folder.key}`} className="document-folder">
          <h4 id={`documents-module-${folder.key}`}>{folder.title}</h4>
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
