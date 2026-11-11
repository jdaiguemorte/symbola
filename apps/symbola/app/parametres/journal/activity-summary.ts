// Lot 23 (HUB-16, ADR 0060) — libellés d'une ligne du journal d'activité :
// l'action, son auteur et le détail utile (numéro, montant, méthode…). Le
// journal ne stocke que des identifiants et des codes ; les textes viennent
// des fichiers de traduction (ActivityLog).
import { isDeletionAction, type AuditDetails } from "@symbola/contracts";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { ActivityEntry } from "@/modules/hub/service";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Has = (key: string) => boolean;

const text = (details: AuditDetails, key: string): string | null => (typeof details[key] === "string" ? (details[key] as string) : null);
const number = (details: AuditDetails, key: string): number | null => (typeof details[key] === "number" ? (details[key] as number) : null);

export function actionLabel(entry: Pick<ActivityEntry, "action">, t: Translate, has: Has): string {
  if (isDeletionAction(entry.action)) {
    const table = `tables.${entry.action.replace(/\.deleted$/, "").replace(".", "_")}`;
    return t("deleted", { object: has(table) ? t(table) : t("objectGeneric") });
  }
  const key = `actions.${entry.action.replaceAll(".", "_")}`;
  return has(key) ? t(key) : entry.action;
}

export function actorLabel(entry: Pick<ActivityEntry, "actorKind" | "actorLabel" | "action">, t: Translate): string {
  if (entry.actorKind === "admin") return t("actorAdmin");
  if (entry.actorKind === "operator") return t("actorOperator");
  if (entry.actorKind === "system") {
    return entry.action === "hub.session.failed" || entry.action === "hub.account.locked" ? t("actorAttempt") : t("actorSystem");
  }
  return entry.actorLabel ?? t("actorUnknown");
}

const METHODS: Record<string, string> = { password: "methodPassword", code: "methodCode", trusted_device: "methodTrustedDevice" };
const FAILURES: Record<string, string> = { password: "failurePassword", code: "failureCode", locked: "failureLocked", disabled: "failureDisabled" };
const STATUSES: Record<string, string> = { completed: "statusCompleted", partial: "statusPartial", pending: "statusPending" };

// Détail d'une ligne, sans donnée personnelle : il n'y en a pas dans le journal.
export function activityDetail(entry: Pick<ActivityEntry, "action" | "details" | "reason">, t: Translate, locale: Locale): string | null {
  const { details } = entry;
  const amount = number(details, "amountCents");
  const money = amount === null ? "" : formatAmount(amount, locale);
  switch (entry.action) {
    case "hub.session.opened":
      return METHODS[text(details, "method") ?? ""] ? t(METHODS[text(details, "method")!]!) : null;
    case "hub.session.failed":
    case "hub.account.locked":
      return FAILURES[text(details, "reason") ?? ""] ? t(FAILURES[text(details, "reason")!]!) : null;
    case "hub.trusted_devices.forgotten":
      return t("devices", { count: number(details, "count") ?? 0 });
    case "hub.sessions.revoked":
      return t("sessionsRevoked", { count: number(details, "count") ?? 0 });
    case "hub.access.refused": {
      const route = text(details, "route");
      return route ? t("refusedRoute", { route }) : null;
    }
    case "hub.module.enabled":
    case "hub.module.disabled": {
      const module = text(details, "module");
      return module ? t("moduleLabel", { module: t(`modules.${module}`) }) : null;
    }
    case "hub.privacy_export.created":
      return t("records", { count: number(details, "records") ?? 0 });
    case "hub.privacy_export.downloaded":
      return text(details, "file") === "archive" ? t("fileArchive") : t("filePdf");
    case "hub.privacy_erasure.executed":
    case "hub.privacy_purge.executed":
      return STATUSES[text(details, "status") ?? ""] ? t(STATUSES[text(details, "status")!]!) : null;
    case "vendors.vendors.exported":
      return t("exportCount", { count: number(details, "count") ?? 0, format: (text(details, "format") ?? "csv").toUpperCase() });
    case "quotes.e_reporting.exported": {
      const from = text(details, "from");
      const to = text(details, "to");
      return from && to ? t("periodRange", { from: formatCalendarDate(from, locale), to: formatCalendarDate(to, locale) }) : null;
    }
    case "quotes.quote.sent":
      return t("quoteVersion", { number: text(details, "number") ?? "", version: number(details, "version") ?? 1 });
    case "quotes.signature.requested":
      return t("signers", { number: text(details, "number") ?? "", count: number(details, "signers") ?? 0 });
    case "quotes.invoice.issued":
      return t("documentAmount", { number: text(details, "number") ?? "", amount: money });
    case "quotes.credit_note.issued":
      return t("creditNote", { number: text(details, "number") ?? "", invoice: text(details, "invoiceNumber") ?? "", amount: money });
    case "quotes.payment.recorded": {
      const paidOn = text(details, "paidOn");
      const quote = text(details, "quoteNumber") ?? "";
      return paidOn ? t("paymentOn", { quote, date: formatCalendarDate(paidOn, locale) }) : t("paymentQuote", { quote });
    }
    case "quotes.payment.cancelled":
      return t("paymentQuote", { quote: text(details, "quoteNumber") ?? "" });
    default:
      return entry.reason ? t("reasonLabel", { reason: entry.reason }) : null;
  }
}

// Lien vers l'objet, pour les objets qui ont leur écran.
export function objectHref(entry: Pick<ActivityEntry, "action" | "objectType" | "objectId">): { href: string; kind: "quote" | "event" } | null {
  if (!entry.objectId || isDeletionAction(entry.action)) return null;
  if (entry.objectType === "quote") return { href: `/devis/${entry.objectId}`, kind: "quote" };
  if (entry.objectType === "event") return { href: `/events/${entry.objectId}`, kind: "event" };
  return null;
}
