import Link from "next/link";
import { EmptyState } from "@/app/ui/empty-state";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { ListRow, ListTable } from "@/app/ui/list-table";
import { PageHeader } from "@/app/ui/page-header";
import { SidePanel } from "@/app/ui/side-panel";
import { Pagination } from "@/app/ui/pagination";
import { requirePlanner } from "@/lib/guards";
import { listContacts } from "@/modules/hub/service";
import { NewContactForm } from "./contact-forms";

type Query = { q?: string; page?: string; nouveau?: string };

// Lot 36a (CRM-03, DAT-12 ; ADR 0069) — les contacts de l'organisation, pour toute l'équipe : une
// personne n'existe qu'une fois, quel que soit le nombre d'évènements et d'apps. Recherche par nom,
// adresse ou téléphone ; ajout d'un contact. Ni les contacts d'essai, ni ceux retirés par le RGPD.
export default async function ContactsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requirePlanner();
  const t = await getTranslations("Contacts");
  const tHelp = await getTranslations("Help");
  const tPage = await getTranslations("Pagination");
  const tCommon = await getTranslations("Common");
  const query = await searchParams;
  const search = query.q?.trim() ?? "";
  const page = Number.parseInt(query.page ?? "1", 10);
  const result = await listContacts(auth.user.organizationId, { search, page: Number.isFinite(page) ? page : 1 });
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  // Lot 39c (UX-13, relevé validé le 17/11) : la création s'ouvre en panneau, comme les modèles.
  const creating = query.nouveau === "1";
  const listHref = search ? `/contacts?${new URLSearchParams({ q: search }).toString()}` : "/contacts";
  const newHref = `/contacts?${new URLSearchParams({ ...(search ? { q: search } : {}), nouveau: "1" }).toString()}`;

  return (
    <main>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link className="button-link" href="/import?type=contacts#import-form">
              {t("importLink")}
            </Link>
            <Link className="button-link button-link-primary" href={newHref} scroll={false}>
              {t("newTitle")}
            </Link>
          </>
        }
      />
      <ScreenHelp title={tHelp("contactsList.title")} body={tHelp("contactsList.body")} />

      <form role="search" aria-label={t("searchLabel")} className="row-wrap">
        <label>
          {t("search")}
          <input type="search" name="q" defaultValue={search} maxLength={100} />
        </label>
        <button type="submit">{t("searchSubmit")}</button>
      </form>

      {result.contacts.length === 0 ? (
        search ? (
          <p>{t("noResults")}</p>
        ) : (
          // Lot 39c (UX-08) : l'écran vide enseigne.
          <EmptyState screen="contacts" title={t("empty")} actionHref={newHref} />
        )
      ) : (
        <ListTable
          label={t("listLabel")}
          head={
            <tr>
              <th scope="col">{t("name")}</th>
              <th scope="col">{t("email")}</th>
              <th scope="col">{t("phone")}</th>
              <th scope="col">{t("city")}</th>
            </tr>
          }
        >
          {result.contacts.map((contact) => (
            <ListRow key={contact.id} href={`/contacts/${contact.id}`}>
              <th scope="row">
                <Link href={`/contacts/${contact.id}`}>{contact.displayName}</Link>
                {contact.kind !== "person" ? <span className="meta"> · {t(`kind.${contact.kind}`)}</span> : null}
              </th>
              <td>{contact.email ?? "—"}</td>
              <td>{contact.phone ?? "—"}</td>
              <td>{contact.city ?? "—"}</td>
            </ListRow>
          ))}
        </ListTable>
      )}
      <Pagination
        page={result.page}
        pageCount={pageCount}
        basePath="/contacts"
        params={{ q: search || undefined }}
        labels={{ nav: tPage("label"), previous: tPage("previous"), next: tPage("next"), status: tPage("status", { page: result.page, count: pageCount }) }}
      />
      {creating ? (
        <SidePanel title={t("newTitle")} closeHref={listHref} closeLabel={tCommon("closePanel")}>
          <NewContactForm />
        </SidePanel>
      ) : null}
    </main>
  );
}
