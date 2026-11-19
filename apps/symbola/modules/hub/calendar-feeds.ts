// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — adresses secrètes des flux de calendrier : une par
// personne de l'équipe (les évènements datés de l'organisation), une par personne et par évènement
// (son programme). Le jeton (32 octets aléatoires) n'est montré qu'une fois ; Symbola n'en garde que
// l'empreinte. L'adresse porte l'organisation, pour lire sous sa RLS (comme un lien personnel,
// ADR 0053). Créer une adresse révoque la précédente ; une adresse révoquée, inconnue, ou celle d'une
// personne qui a quitté l'équipe ne répond rien. Exposé seulement par service.ts (ADR 0011).
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { calendarFeeds } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { isOrganizationClosed } from "./organization-closures";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
// La date de dernière lecture ne s'écrit pas plus d'une fois par heure (les agendas relisent souvent).
const LAST_USED_GRAIN_MS = 60 * 60 * 1000;

export type CalendarFeedView = { id: string; eventId: string | null; createdAt: string; lastUsedAt: string | null };
export type CalendarFeedAccess = { feedId: string; organizationId: string; userId: string; eventId: string | null };

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toView(row: typeof calendarFeeds.$inferSelect): CalendarFeedView {
  return { id: row.id, eventId: row.eventId, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null };
}

function sameTarget(userId: string, eventId: string | null) {
  return and(eq(calendarFeeds.userId, userId), eventId ? eq(calendarFeeds.eventId, eventId) : isNull(calendarFeeds.eventId), isNull(calendarFeeds.revokedAt));
}

// Crée l'adresse (ou la régénère : l'ancienne cesse aussitôt). Le jeton n'est rendu qu'ici.
export async function issueCalendarFeed(input: { organizationId: string; userId: string; eventId: string | null; now?: Date }): Promise<{ token: string; feed: CalendarFeedView }> {
  const secret = randomBytes(32).toString("base64url");
  const now = input.now ?? new Date();
  const feed = await withOrganization(appDatabase(), input.organizationId, async (tx) => {
    await tx.update(calendarFeeds).set({ revokedAt: now }).where(sameTarget(input.userId, input.eventId));
    const [row] = await tx.insert(calendarFeeds).values({ organizationId: input.organizationId, userId: input.userId, eventId: input.eventId, tokenHash: hashSecret(secret) }).returning();
    return row!;
  });
  return { token: `${input.organizationId}.${secret}`, feed: toView(feed) };
}

export async function revokeCalendarFeed(input: { organizationId: string; userId: string; eventId: string | null; now?: Date }): Promise<void> {
  await withOrganization(appDatabase(), input.organizationId, (tx) => tx.update(calendarFeeds).set({ revokedAt: input.now ?? new Date() }).where(sameTarget(input.userId, input.eventId)));
}

// Les adresses actives d'une personne : la sienne (event_id nul) et celles des programmes suivis.
export async function listCalendarFeeds(organizationId: string, userId: string): Promise<CalendarFeedView[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(calendarFeeds)
      .where(and(eq(calendarFeeds.userId, userId), isNull(calendarFeeds.revokedAt)))
      .orderBy(desc(calendarFeeds.createdAt)),
  );
  return rows.map(toView);
}

// L'adresse d'un flux : null si le jeton est mal formé, inconnu ou révoqué, ou si la personne n'est
// plus dans l'équipe de l'organisation (compte retiré ou désactivé).
export async function resolveCalendarFeed(token: string, now: Date = new Date()): Promise<CalendarFeedAccess | null> {
  const [organizationId, secret, ...rest] = token.split(".");
  if (!organizationId || !secret || rest.length > 0 || !UUID.test(organizationId) || !SECRET.test(secret)) return null;
  const db = appDatabase();
  // Lot 35c (RGP-11) : un espace fermé n'alimente plus les agendas.
  if (await isOrganizationClosed(db, organizationId)) return null;
  const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(calendarFeeds).where(and(eq(calendarFeeds.tokenHash, hashSecret(secret)), isNull(calendarFeeds.revokedAt))));
  if (!row) return null;
  const member = (await listTeam(db, organizationId)).find((candidate) => candidate.id === row.userId);
  if (!member || member.disabledAt) return null;
  await withOrganization(db, organizationId, (tx) =>
    tx
      .update(calendarFeeds)
      .set({ lastUsedAt: now })
      .where(and(eq(calendarFeeds.id, row.id), or(isNull(calendarFeeds.lastUsedAt), lt(calendarFeeds.lastUsedAt, new Date(now.getTime() - LAST_USED_GRAIN_MS))))),
  );
  return { feedId: row.id, organizationId, userId: row.userId, eventId: row.eventId };
}
