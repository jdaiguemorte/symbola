// Lot 39a (HUB-17, DAT-03, UX-07 ; D2, D5 ; ADR 0073) — Paramètres › Corbeille : ce qui a été
// supprimé depuis moins de 30 jours (évènements avec tout leur contenu, contacts, documents,
// modèles), qui l'a supprimé, quand la purge l'effacera ; « Restaurer » pour toute l'équipe,
// « Supprimer définitivement » (confirmé, l'objet nommé) pour la titulaire seule. Lot 70b (UX-07 ; M6) :
// niveau 3 du danger, une case « Je comprends que … ne pourra pas être récupéré » à cocher d'abord.
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/app/ui/empty-state";
import { listTeam } from "@symbola/auth";
import { trashPurgeDate } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { formatDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { listTrash } from "@/lib/trash";
import { deleteTrashItemForGoodAction, restoreTrashItemAction } from "./actions";

const OUTCOMES = ["rendu", "conflit", "introuvable", "efface", "reserve"] as const;
type Outcome = (typeof OUTCOMES)[number];

export default async function TrashPage({ searchParams }: { searchParams: Promise<{ resultat?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Trash");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const isOwner = auth.user.role === "owner";
  const [items, team] = await Promise.all([listTrash(organizationId), listTeam(appDatabase(), organizationId)]);
  const authors = new Map(team.map((member) => [member.id, member.email]));
  const raw = (await searchParams).resultat;
  const outcome = OUTCOMES.find((value) => value === raw) as Outcome | undefined;

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("trash.title")} body={tHelp("trash.body")} />
      {outcome ? <p role={outcome === "rendu" || outcome === "efface" ? "status" : "alert"}>{t(`outcome.${outcome}`)}</p> : null}
      {/* Lot 39c (UX-08) : l'écran vide enseigne. */}
      {items.length === 0 ? <EmptyState screen="trash" title={t("empty")} actionHref="/" /> : null}
      {items.length > 0 ? (
        <ul className="item-list" aria-label={t("title")}>
          {items.map((item) => {
            // Lot 70a (A5) : des tâches supprimées d'un même geste font une ligne (« 3 tâches de Léa & Maxime »).
            const name = item.count ? (item.eventId && item.label ? t("taskBatch", { count: item.count, event: item.label }) : t("taskBatchNoEvent", { count: item.count })) : item.label || t("unnamed");
            const author = item.deletedBy ? authors.get(item.deletedBy) : undefined;
            return (
              <li key={`${item.kind}:${item.id}`}>
                <h2>
                  {t(`kinds.${item.kind}`)} · {name}
                </h2>
                <p className="meta">
                  {author ? t("deletedBy", { date: formatDateTime(item.deletedAt, locale), author }) : t("deletedOn", { date: formatDateTime(item.deletedAt, locale) })}{" "}
                  · {t("purgeOn", { date: formatDate(trashPurgeDate(item.deletedAt), locale) })}
                </p>
                <div className="row-wrap">
                  <form action={restoreTrashItemAction}>
                    <input type="hidden" name="kind" value={item.kind} />
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="button-ghost" aria-label={t("restoreNamed", { name })}>
                      {t("restore")}
                    </button>
                  </form>
                  {isOwner ? (
                    <ConfirmDialog
                      level={3}
                      trigger={t("deleteForGood")}
                      triggerLabel={t("deleteForGoodNamed", { name })}
                      triggerClassName="link-button"
                      title={t("deleteForGoodTitle", { kind: t(`kinds.${item.kind}`), name })}
                      body={t("deleteForGoodBody")}
                      confirmLabel={t("deleteForGood")}
                      keepLabel={t("deleteForGoodKeep")}
                      acknowledgeLabel={t("deleteForGoodAcknowledge", { name })}
                      action={deleteTrashItemForGoodAction}
                      fields={{ kind: item.kind, id: item.id }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
