// Lot 46 — le résultat d'une action, revenu dans l'adresse sous une clé connue (jamais un texte libre).
import { getTranslations } from "next-intl/server";
import { ErrorNotice } from "@/app/ui/notices";

const OK = ["pageSaved", "typeCreated", "startersAdded", "typeSaved", "typeTrashed", "availabilitySaved", "closureAdded", "closureRemoved", "sourceAdded", "sourceRefreshed", "sourceRemoved", "created", "cancelled", "moved", "trashed", "linked", "unlinked", "optionCreated", "reportSaved", "actionAdded", "actionRemoved", "taskCreated"] as const;
const ERRORS = [
  "slugTaken",
  "calendarUrl",
  "notLinked",
  "notFound",
  "unexpected",
  "invalid.slug",
  "invalid.privacyNotice",
  "invalid.name",
  "invalid.durationMinutes",
  "invalid.location",
  "invalid.locationKind",
  "invalid.questions",
  "invalid.rules",
  "invalid.closure",
  "invalid.reason",
  "invalid.label",
  "invalid.sources",
  "invalid.calendarUrl",
  "invalid.startsAt",
  "invalid.email",
  "invalid.phone",
  "invalid.eventId",
  "invalid.status",
  "invalid.prospectSourceId",
  "invalid.notes",
  "invalid.dueOn",
  "invalid.host",
] as const;

type OkKey = (typeof OK)[number];
type ErrorKey = (typeof ERRORS)[number];

export async function Notice({ ok, error }: { ok?: string | undefined; error?: string | undefined }) {
  const t = await getTranslations("Appointments");
  if (error) {
    const key: ErrorKey = (ERRORS as readonly string[]).includes(error) ? (error as ErrorKey) : error.startsWith("invalid.") ? "invalid.name" : "unexpected";
    return <ErrorNotice>{t(`errors.${key}`)}</ErrorNotice>;
  }
  if (ok && (OK as readonly string[]).includes(ok)) {
    return (
      <p className="notice" role="status">
        {t(`ok.${ok as OkKey}`)}
      </p>
    );
  }
  return null;
}
