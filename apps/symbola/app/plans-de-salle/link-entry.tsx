// Lot 60 (L60-PLA-05) — l'entrée « Plan de salle » d'un espace de lien (prestataire retenu, client à
// qui la rubrique est ouverte) : seulement si un plan est diffusé ; une version nouvelle est signalée.
// Rien sans le module (ARC-07) ; l'aperçu « vu par » de la planner n'y laisse aucune trace.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LinkAccess } from "@/modules/events/service";
import { floorplansForLink } from "@/modules/floorplans/service";
import { linkFloorplanAccess } from "./link-access";

export async function FloorplanLinkEntry({ access, audience, preview = false }: { access: LinkAccess; audience: "vendor" | "client"; preview?: boolean }) {
  const scoped = await linkFloorplanAccess(audience, access);
  if (!scoped) return null;
  const plans = await floorplansForLink(scoped, { markSeen: false });
  if (plans.length === 0) return null;
  const t = await getTranslations("Floorplans.shared");
  const unseen = plans.filter((plan) => plan.isNew).length;
  const href = audience === "vendor" ? "/prestataire/plan-de-salle" : "/portail/plan-de-salle";
  return (
    <section className="card" aria-labelledby="floorplan-entry-title">
      <h2 id="floorplan-entry-title">{t("title")}</h2>
      {unseen > 0 ? (
        <p role="status" className="badge-warning">
          {t("newVersions", { count: unseen })}
        </p>
      ) : null}
      <p>{preview ? <span>{t("open")}</span> : <Link href={href}>{t("open")}</Link>}</p>
    </section>
  );
}
