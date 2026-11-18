// Lot 52 (HUB-05, SEC-08 ; D4 ; ADR 0094) — « Mes sessions » : chaque session ouverte du compte, son
// appareil (navigateur et système, sans adresse IP ni ville) et sa dernière activité ; fermer l'une
// d'elles, ou toutes les autres. Le lien « Ce n'est pas moi » d'une alerte de nouvel appareil ferme
// toutes les sessions du compte. Une session fermée ici est refusée à sa requête suivante (requireUser
// relit la session à chaque requête). Les sessions du fournisseur d'identité sont fermées par l'app
// (adaptateur de l'API d'administration), quand Symbola n'en garde plus aucune.
import { and, asc, desc, eq, gt, isNotNull, lt } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { knownDevices, sessions, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";
import { hashAlertToken, parseDeviceLabel, type DeviceLabel } from "./devices";
import { hashSessionToken } from "./session-token";

export type AccountSession = {
  id: string;
  device: DeviceLabel;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
};

export async function listAccountSessions(db: AppDatabase, input: { userId: string; currentSessionToken: string | undefined; now?: Date }): Promise<AccountSession[]> {
  const now = input.now ?? new Date();
  const current = input.currentSessionToken ? hashSessionToken(input.currentSessionToken) : null;
  const rows = await db
    .select({ id: sessions.id, tokenHash: sessions.tokenHash, deviceLabel: sessions.deviceLabel, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.userId, input.userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));
  return rows
    .map((row) => ({
      id: row.id,
      device: parseDeviceLabel(row.deviceLabel),
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt ?? row.createdAt,
      current: row.tokenHash === current,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

async function accountRole(db: AppDatabase, userId: string): Promise<"admin" | "member" | null> {
  const [account] = await db.select({ operator: users.operator }).from(users).where(eq(users.id, userId));
  return account ? (account.operator ? "admin" : "member") : null;
}

async function remainingSessions(db: AppDatabase, userId: string): Promise<number> {
  return (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId))).length;
}

export type CloseSessionOutcome = { status: "closed"; remaining: number } | { status: "not_found" };

// Fermer une session de son propre compte ; la session d'un autre compte répond comme inexistante.
export async function closeAccountSession(db: AppDatabase, input: { userId: string; sessionId: string }): Promise<CloseSessionOutcome> {
  const [closed] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)))
    .returning({ organizationId: sessions.organizationId });
  if (!closed) return { status: "not_found" };
  const role = await accountRole(db, input.userId);
  if (role) await journalConnection(db, { id: input.userId, organizationId: closed.organizationId, role }, "hub.session.closed", { details: { remote: true } });
  return { status: "closed", remaining: await remainingSessions(db, input.userId) };
}

// « Ce n'est pas moi » : toutes les sessions du compte, et les alertes en attente de cet appareil.
export async function closeAllAccountSessions(db: AppDatabase, input: { userId: string; reason: "not_me" | "revoked" }): Promise<number> {
  const closed = await db.delete(sessions).where(eq(sessions.userId, input.userId)).returning({ id: sessions.id });
  const role = await accountRole(db, input.userId);
  if (role) await journalConnection(db, { id: input.userId, organizationId: null, role }, "hub.sessions.revoked", { details: { count: closed.length, reason: input.reason } });
  return closed.length;
}

export type DisownedDevice = { userId: string; email: string; idpSubject: string | null };

// Le jeton du lien « Ce n'est pas moi », valable sept jours et une seule fois : le compte concerné,
// dont l'appelant ferme toutes les sessions. Jeton inconnu, déjà utilisé ou expiré : null, sans détail.
export async function disownDeviceAlert(db: AppDatabase, token: string, now: Date = new Date()): Promise<DisownedDevice | null> {
  if (!token || token.length > 128) return null;
  // L'appareil inconnu n'est plus retenu (sa prochaine connexion alertera de nouveau) ; le jeton ne
  // sert qu'une fois.
  const [device] = await db
    .delete(knownDevices)
    .where(and(eq(knownDevices.alertTokenHash, hashAlertToken(token)), isNotNull(knownDevices.alertExpiresAt), gt(knownDevices.alertExpiresAt, now)))
    .returning({ userId: knownDevices.userId });
  if (!device) return null;
  const [account] = await db.select({ email: users.email, idpSubject: users.idpSubject }).from(users).where(eq(users.id, device.userId));
  return account ? { userId: device.userId, ...account } : null;
}

// Le jeton « Ce n'est pas moi » encore valable ? Pour la page de confirmation (lecture seule).
export async function isDeviceAlertTokenValid(db: AppDatabase, token: string, now: Date = new Date()): Promise<boolean> {
  if (!token || token.length > 128) return false;
  const [device] = await db
    .select({ userId: knownDevices.userId })
    .from(knownDevices)
    .where(and(eq(knownDevices.alertTokenHash, hashAlertToken(token)), gt(knownDevices.alertExpiresAt, now)));
  return Boolean(device);
}

// DPO (lot 52) : un appareil inactif depuis 30 jours est oublié ; ses alertes avec lui.
export const KNOWN_DEVICE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeKnownDevices(db: AppDatabase, now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(knownDevices)
    .where(lt(knownDevices.lastSeenAt, new Date(now.getTime() - KNOWN_DEVICE_RETENTION_MS)))
    .returning({ userId: knownDevices.userId });
  return deleted.length;
}

// Ordre stable des appareils connus d'un compte (tests et assistance).
export async function listKnownDevices(db: AppDatabase, userId: string): Promise<{ deviceId: string; device: DeviceLabel; lastSeenAt: Date }[]> {
  const rows = await db.select().from(knownDevices).where(eq(knownDevices.userId, userId)).orderBy(asc(knownDevices.firstSeenAt));
  return rows.map((row) => ({ deviceId: row.deviceId, device: parseDeviceLabel(row.deviceLabel), lastSeenAt: row.lastSeenAt }));
}
