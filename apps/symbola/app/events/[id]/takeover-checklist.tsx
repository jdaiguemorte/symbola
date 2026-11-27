// Lot 71f (EVT-02, UX-01, UX-06 ; spécification du lot 71, § 5.6 ; maquette 09 ; R9 ; C-24, C-55, C-56)
// — sur la Synthèse d'un mariage repris, « À compléter après la reprise » à la place de « Prochaine
// action » et du bandeau « Prochaine étape » : un point par ligne, son nombre, sa phrase et son bouton ;
// un point fait passe en bas, coché. Une fois tout fait, « Reprise complétée le … » reste sept jours.
// La marque de provenance et ce bloc ne sont jamais montrés aux mariés (le portail ne les lit pas).
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { ChecklistBlock, ChecklistPoint } from "@/lib/takeover/checklist-rules";

type Hrefs = { budget: string; tasksTakeover: string; tasksTemplate: string; program: string; clients: string; guests: string };

function pointActions(point: ChecklistPoint, hrefs: Hrefs): { key: string; href: string; primary: boolean }[] {
  switch (point.key) {
    case "amounts":
      return [{ key: "action", href: hrefs.budget, primary: true }];
    case "contracts":
      return [{ key: "action", href: hrefs.budget, primary: false }];
    case "tasks":
      return [
        { key: "action", href: hrefs.tasksTakeover, primary: false },
        { key: "actionTemplate", href: hrefs.tasksTemplate, primary: false },
      ];
    case "endTimes":
      return [{ key: "action", href: hrefs.program, primary: false }];
    case "clientLink":
      return [{ key: "action", href: hrefs.clients, primary: false }];
    case "guests":
      return [{ key: "action", href: hrefs.guests, primary: false }];
  }
}

export async function TakeoverChecklist({ block, hrefs, locale, reviewHref, review }: { block: Exclude<ChecklistBlock, { kind: "hidden" }>; hrefs: Hrefs; locale: Locale; reviewHref: string; review: boolean }) {
  const t = await getTranslations("TakeoverSheet");
  if (block.kind === "completed" && !review) {
    return (
      <section className="card takeover-completed" id="a-completer" aria-labelledby="takeover-checklist-title">
        <p>
          <CheckCircle2 size={18} aria-hidden="true" /> <strong id="takeover-checklist-title">{t("completed", { date: formatCalendarDate(block.completedOn, locale) })}</strong> {t("completedBody", { count: block.points.length })}{" "}
          <Link href={reviewHref} scroll={false}>
            {t("completedReview")}
          </Link>
        </p>
      </section>
    );
  }
  const done = block.points.filter((point) => point.done).length;
  return (
    <section className="card takeover-checklist" id="a-completer" aria-labelledby="takeover-checklist-title" data-tour="event-overview">
      <div className="section-head">
        <h2 id="takeover-checklist-title">{t("checklistTitle")}</h2>
        <p className="meta" role="status">
          {t("checklistCount", { total: block.points.length, done })}
        </p>
      </div>
      <ul className="takeover-points" aria-label={t("checklistLabel")}>
        {block.points.map((point) => {
          const title = t(`point.${point.key}.title`, { count: point.count });
          const body = point.done
            ? t(`point.${point.key}.bodyDone`)
            : point.key === "amounts" && point.remainingCents !== null
              ? t("point.amounts.bodyRemaining", { amount: formatAmount(point.remainingCents, locale) })
              : point.key === "contracts"
                ? t("point.contracts.body", { names: point.names.join(", ") })
                : t(`point.${point.key}.body`);
          return (
            <li key={point.key} className={point.done ? "takeover-point takeover-point-done" : "takeover-point"} data-point={point.key}>
              {point.done ? <CheckCircle2 size={18} aria-hidden="true" className="takeover-point-icon" /> : <Circle size={18} aria-hidden="true" className="takeover-point-icon" />}
              <div className="takeover-point-text">
                <strong>{title}</strong>
                {point.done ? <span className="badge badge-sauge">{t("pointDone")}</span> : null}
                <span className="meta">{body}</span>
              </div>
              {point.done ? null : (
                <div className="row-wrap takeover-point-actions">
                  {pointActions(point, hrefs).map((action) => (
                    <Link key={action.key} href={action.href} className={action.primary ? "button-link button-link-primary" : "button-link"}>
                      {t(`point.${point.key}.${action.key}`)}
                      <span className="sr-only"> — {title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
