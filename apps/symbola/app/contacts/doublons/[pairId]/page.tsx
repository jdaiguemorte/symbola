// Lot 45 (CRM-07 ; D4, D5 ; ADR 0090) — comparer deux fiches et les fusionner : la fiche gardée, la
// valeur de chaque champ, et ce que chacune réunit (évènements, notes, messages, rendez-vous, liens,
// signatures) ; la fiche absorbée disparaît, son historique passe à la fiche gardée.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import type { Contact } from "@symbola/contracts";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { countContactAppointments } from "@/modules/appointments/service";
import { countEventsContactReferences } from "@/modules/events/service";
import { getContactsByIds, getDuplicatePair, isModuleEnabled, listContactNotes, MERGEABLE_FIELDS } from "@/modules/hub/service";
import { countContactSignatures } from "@/modules/quotes/service";
import { MergeForm, type MergeRow } from "./merge-form";

export default async function ContactMergePage({ params }: { params: Promise<{ pairId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { pairId } = await params;
  if (!isValidId(pairId)) notFound();
  const pair = await getDuplicatePair(organizationId, pairId);
  if (!pair) notFound();
  const contacts = await getContactsByIds(organizationId, [pair.firstContactId, pair.secondContactId]);
  const first = contacts.get(pair.firstContactId);
  const second = contacts.get(pair.secondContactId);
  if (!first || !second) notFound();
  const t = await getTranslations("ContactDuplicates");
  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const [eventsOn, quotesOn, appointmentsOn] = await Promise.all([isModuleEnabled(db, organizationId, "events"), isModuleEnabled(db, organizationId, "quotes"), isModuleEnabled(db, organizationId, "appointments")]);

  // Ce que la fiche réunit, module par module (chacun par son service, ARC-01).
  async function gathered(contact: Contact): Promise<string[]> {
    const lines = [t("gathered.notes", { name: contact.displayName, count: (await listContactNotes(organizationId, contact.id)).length })];
    if (eventsOn) {
      const counts = await countEventsContactReferences(organizationId, contact.id);
      lines.push(t("gathered.events", { name: contact.displayName, events: counts.events, messages: counts.messages, links: counts.links, questionnaires: counts.questionnaires }));
    }
    if (appointmentsOn) lines.push(t("gathered.appointments", { name: contact.displayName, count: await countContactAppointments(organizationId, contact.id) }));
    if (quotesOn) lines.push(t("gathered.signatures", { name: contact.displayName, count: await countContactSignatures(organizationId, contact.id) }));
    return lines;
  }

  const rows: MergeRow[] = MERGEABLE_FIELDS.filter((field) => first[field] || second[field]).map((field) => ({ field, label: t(`fields.${field}`), first: first[field] || null, second: second[field] || null }));
  return (
    <main className="stack">
      <Link href="/contacts/doublons" className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("backToList")}
      </Link>
      <PageHeader title={t("mergeTitle")} subtitle={t(`reason.${pair.reason}`)} />
      <ScreenHelp title={tHelp("contactMerge.title")} body={tHelp("contactMerge.body")} />
      <MergeForm pairId={pair.id} first={{ id: first.id, name: first.displayName, gathered: await gathered(first) }} second={{ id: second.id, name: second.displayName, gathered: await gathered(second) }} rows={rows} />
    </main>
  );
}
