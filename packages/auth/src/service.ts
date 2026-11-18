// Porte d'entrée unique de l'authentification (SOC-04, ADR 0013 ; lot 33 : ADR 0052 et 0067).
// Aucun autre code n'appelle packages/db sur les tables d'identité du hub : tout passe par les
// fonctions exportées d'ici.
//
// Depuis le lot 33, Symbola ne vérifie plus aucun mot de passe ni code : le fournisseur
// d'identité authentifie (OpenID Connect, identity/oidc.ts), puis signInWithIdentity ouvre la
// session Symbola, opaque, comme avant. Un compte peut appartenir à plusieurs organisations
// (hub.memberships, HUB-02) ; la session porte l'organisation active, relue à chaque requête.
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { knownDevices, memberships, organizations, sessions, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";
import { deviceLabelOf, formatDeviceLabel, hashAlertToken, newAlertToken, newDeviceId, validDeviceId } from "./devices";
import type { IdentityClaims } from "./identity/oidc";
import { requiresMfa as roleRequiresMfa, type MembershipRole, type Role } from "./roles";
import { generateSessionToken, hashSessionToken } from "./session-token";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 h sans activité, glissantes
// Lot 52 (HUB-05, D4) : la dernière activité d'une session s'écrit au plus une fois par heure.
export const SESSION_ACTIVITY_STEP_MS = 60 * 60 * 1000;
// Lot 52 (SEC-08) : le lien « Ce n'est pas moi » d'une alerte de nouvel appareil vaut sept jours.
export const DEVICE_ALERT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// D4 (lot 33) : la double authentification est demandée après « Votre espace est prêt », pas
// pendant l'inscription. Seule la séance ouverte par l'inscription elle-même en est dispensée :
// sa session naît dans la minute qui suit la création du compte.
const SIGNUP_GRACE_MS = 60 * 1000;
// Nom provisoire de l'organisation créée à l'inscription (HUB-02), modifiable au démarrage.
export const PROVISIONAL_ORGANIZATION_NAME = "Mon atelier";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  // Organisation active de la session ; nulle pour l'Exploitation.
  organizationId: string | null;
  // Choix explicite dans le profil (PRD-HUB-04) ; nul = pas encore choisi.
  language: "fr" | "en" | null;
  // AIDE-04 : liste « premiers pas » masquée par l'utilisateur.
  firstStepsHidden: boolean;
  // La session a été ouverte avec une double authentification (déclaration acr).
  mfaEnabled: boolean;
  // Lot 52 (HUB-05) : la session en cours, pour la marquer « cet appareil ».
  sessionId?: string;
};

export type AuthResult =
  | { status: "unauthenticated" }
  // D4 : la Propriétaire et l'Exploitation doivent se reconnecter avec leur double
  // authentification (ou l'installer d'abord, dans le centre de compte du fournisseur).
  | { status: "mfa_required"; userId: string; role: Role }
  | { status: "authenticated"; user: AuthenticatedUser };

export async function createOrganization(db: AppDatabase, name: string) {
  const [organization] = await db.insert(organizations).values({ name }).returning();
  return organization!;
}

// Compte d'organisation (avec son adhésion) ou d'exploitation (role « admin »). Utilisé par la
// création de comptes en ligne de commande, le jeu de recette et les tests ; le compte se
// connecte ensuite par le fournisseur d'identité, retrouvé par son adresse. `password` n'est plus
// lu (lot 33) : il reste accepté le temps que les appelants s'en défassent.
export async function createUser(db: AppDatabase, input: { organizationId: string | null; email: string; password?: string; role: Role }) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: input.email.toLowerCase(), operator: input.role === "admin" })
      .returning();
    if (input.organizationId && input.role !== "admin") {
      await tx.insert(memberships).values({ userId: user!.id, organizationId: input.organizationId, role: input.role });
    }
    return user!;
  });
}

export async function addMembership(db: AppDatabase, input: { userId: string; organizationId: string; role: MembershipRole }): Promise<void> {
  await db.insert(memberships).values(input).onConflictDoNothing();
}

// Invitation acceptée (lot 33, HUB-02) : le compte de l'adresse invitée, créé s'il n'existe pas,
// reçoit l'adhésion à l'organisation. Un compte qui a déjà d'autres organisations les garde. Lot 33b
// (HUB-03) : une adhésion retirée se rouvre quand la Propriétaire invite de nouveau la personne ;
// le rôle d'une adhésion active ne change pas (transfert de propriété : lot 52). Lot 52 : une adhésion
// retirée se rouvre avec le rôle de la nouvelle invitation (Planner ou Comptable).
export async function ensureMembership(db: AppDatabase, input: { organizationId: string; email: string; role: MembershipRole }): Promise<{ userId: string }> {
  const email = input.email.toLowerCase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    const userId = existing?.id ?? (await tx.insert(users).values({ email }).returning({ id: users.id }))[0]!.id;
    await tx
      .insert(memberships)
      .values({ userId, organizationId: input.organizationId, role: input.role })
      .onConflictDoUpdate({ target: [memberships.userId, memberships.organizationId], set: { disabledAt: null, role: input.role }, setWhere: isNotNull(memberships.disabledAt) });
    return { userId };
  });
}

// Lot 52 (SEC-08) : connexion depuis un appareil inconnu de ce compte ; le jeton du lien « Ce n'est pas
// moi » n'est remis qu'ici, pour l'e-mail d'alerte.
export type NewDeviceAlert = { alertToken: string; deviceLabel: string; at: Date };

export type SignInOutcome =
  // requiresMfa : Propriétaire ou Comptable de l'organisation ouverte, ou Exploitation (D4, lot 52).
  // deviceId : identifiant d'appareil à garder dans le cookie (lot 52, HUB-05).
  | { outcome: "signed_in"; sessionToken: string; userId: string; organizationId: string | null; isNewAccount: boolean; requiresMfa: boolean; deviceId: string; newDevice: NewDeviceAlert | null }
  // Compte désactivé, ou plus aucune organisation active (accès retirés) : refus, sans détail.
  | { outcome: "refused" };

// Après l'authentification par le fournisseur : retrouve le compte par son identifiant chez le
// fournisseur, sinon par son adresse vérifiée (reprise des comptes, partie F), sinon le crée
// avec son organisation et son adhésion de Propriétaire (inscription libre, HUB-01, HUB-02).
export async function signInWithIdentity(
  db: AppDatabase,
  claims: IdentityClaims,
  options: { preferredOrganizationId?: string | null; clientIp?: string | null; now?: Date; device?: { id?: string | null; userAgent?: string | null } } = {},
): Promise<SignInOutcome> {
  const now = options.now ?? new Date();
  const email = claims.email.toLowerCase();
  const deviceId = validDeviceId(options.device?.id) ?? newDeviceId();
  const deviceLabel = formatDeviceLabel(deviceLabelOf(options.device?.userAgent));
  const result = await db.transaction(async (tx) => {
    let isNewAccount = false;
    let [user] = await tx.select().from(users).where(eq(users.idpSubject, claims.subject));
    if (!user) {
      const [byEmail] = await tx.select().from(users).where(eq(users.email, email));
      if (byEmail && byEmail.idpSubject && byEmail.idpSubject !== claims.subject) return { outcome: "refused" } as const;
      if (byEmail) {
        [user] = await tx.update(users).set({ idpSubject: claims.subject }).where(eq(users.id, byEmail.id)).returning();
      } else {
        isNewAccount = true;
        [user] = await tx.insert(users).values({ email, idpSubject: claims.subject, createdAt: now }).returning();
        const [organization] = await tx.insert(organizations).values({ name: PROVISIONAL_ORGANIZATION_NAME }).returning();
        await tx.insert(memberships).values({ userId: user!.id, organizationId: organization!.id, role: "owner" });
      }
    }
    if (!user || user.disabledAt) return { outcome: "refused" } as const;

    let organizationId: string | null = null;
    let requiresMfa = user.operator;
    if (!user.operator) {
      const active = await tx
        .select({ organizationId: memberships.organizationId, role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.userId, user.id), isNull(memberships.disabledAt)))
        .orderBy(asc(memberships.createdAt));
      if (active.length === 0) return { outcome: "refused" } as const;
      const preferred = active.find((membership) => membership.organizationId === options.preferredOrganizationId);
      const chosen = preferred ?? active[0]!;
      organizationId = chosen.organizationId;
      requiresMfa = roleRequiresMfa(chosen.role);
    }

    const sessionToken = generateSessionToken();
    await tx.insert(sessions).values({
      userId: user.id,
      organizationId,
      tokenHash: hashSessionToken(sessionToken),
      mfaVerified: claims.mfa,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      createdAt: now,
      deviceLabel,
      deviceId,
      lastSeenAt: now,
    });
    await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
    const newDevice = await rememberDevice(tx, { userId: user.id, deviceId, deviceLabel, now, silent: isNewAccount });
    return { outcome: "signed_in", sessionToken, userId: user.id, organizationId, isNewAccount, requiresMfa, operator: user.operator, deviceId, newDevice } as const;
  });
  if (result.outcome === "signed_in") {
    await journalConnection(db, { id: result.userId, organizationId: result.organizationId, role: result.operator ? "admin" : "member" }, "hub.session.opened", {
      details: { method: claims.mfa ? "identity_mfa" : "identity" },
      clientIp: options.clientIp,
    });
    const { operator: _operator, ...outcome } = result;
    return outcome;
  }
  return result;
}

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

// SEC-08 : un appareil inconnu du compte est retenu, avec le haché du jeton « Ce n'est pas moi », et
// l'alerte est demandée. Le premier appareil d'un compte (inscription, ou premier passage après le lot
// 52) est retenu sans alerte : rien n'était encore connu.
async function rememberDevice(tx: Tx, input: { userId: string; deviceId: string; deviceLabel: string; now: Date; silent: boolean }): Promise<NewDeviceAlert | null> {
  const known = await tx.select({ deviceId: knownDevices.deviceId }).from(knownDevices).where(eq(knownDevices.userId, input.userId));
  if (known.some((device) => device.deviceId === input.deviceId)) {
    await tx
      .update(knownDevices)
      .set({ lastSeenAt: input.now, deviceLabel: input.deviceLabel })
      .where(and(eq(knownDevices.userId, input.userId), eq(knownDevices.deviceId, input.deviceId)));
    return null;
  }
  if (input.silent || known.length === 0) {
    await tx.insert(knownDevices).values({ userId: input.userId, deviceId: input.deviceId, deviceLabel: input.deviceLabel, firstSeenAt: input.now, lastSeenAt: input.now });
    return null;
  }
  const alertToken = newAlertToken();
  await tx.insert(knownDevices).values({
    userId: input.userId,
    deviceId: input.deviceId,
    deviceLabel: input.deviceLabel,
    firstSeenAt: input.now,
    lastSeenAt: input.now,
    alertTokenHash: hashAlertToken(alertToken),
    alertExpiresAt: new Date(input.now.getTime() + DEVICE_ALERT_TTL_MS),
  });
  return { alertToken, deviceLabel: input.deviceLabel, at: input.now };
}

type SessionRow = {
  userId: string;
  email: string;
  operator: boolean;
  userCreatedAt: Date;
  language: "fr" | "en" | null;
  firstStepsHidden: boolean;
  disabledAt: Date | null;
  organizationId: string | null;
  mfaVerified: boolean;
  expiresAt: Date;
  sessionCreatedAt: Date;
  sessionId: string;
  lastSeenAt: Date | null;
  membershipRole: MembershipRole | null;
};

async function readSession(db: AppDatabase, tokenHash: string): Promise<SessionRow | null> {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      operator: users.operator,
      userCreatedAt: users.createdAt,
      language: users.language,
      firstStepsHidden: users.firstStepsHidden,
      disabledAt: users.disabledAt,
      organizationId: sessions.organizationId,
      mfaVerified: sessions.mfaVerified,
      expiresAt: sessions.expiresAt,
      sessionCreatedAt: sessions.createdAt,
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      membershipRole: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(
      memberships,
      and(eq(memberships.userId, sessions.userId), eq(memberships.organizationId, sessions.organizationId), isNull(memberships.disabledAt)),
    )
    .where(eq(sessions.tokenHash, tokenHash));
  return row ?? null;
}

// Rôle de la session, ou null si elle ne donne plus accès (compte désactivé, adhésion retirée).
function sessionRole(row: SessionRow): Role | null {
  if (row.disabledAt) return null;
  if (row.operator) return "admin";
  if (!row.organizationId || !row.membershipRole) return null;
  return row.membershipRole;
}

// D4 : Propriétaire, Comptable (lot 52) et Exploitation sans double authentification dans cette
// session ? La séance ouverte par l'inscription en est seule dispensée (Propriétaire seulement).
function missesMfa(row: SessionRow, role: Role): boolean {
  if (row.mfaVerified || !roleRequiresMfa(role)) return false;
  if (role === "owner" && row.sessionCreatedAt.getTime() - row.userCreatedAt.getTime() <= SIGNUP_GRACE_MS) return false;
  return true;
}

export async function requireUser(db: AppDatabase, sessionToken: string | undefined): Promise<AuthResult> {
  if (!sessionToken) return { status: "unauthenticated" };
  const tokenHash = hashSessionToken(sessionToken);
  const row = await readSession(db, tokenHash);
  if (!row || row.expiresAt.getTime() < Date.now()) return { status: "unauthenticated" };
  const role = sessionRole(row);
  if (!role) return { status: "unauthenticated" };

  // Session glissante : chaque appel réussi repousse l'expiration. Lot 52 (HUB-05) : la dernière
  // activité, au plus une fois par heure.
  const now = Date.now();
  const touch = !row.lastSeenAt || now - row.lastSeenAt.getTime() >= SESSION_ACTIVITY_STEP_MS;
  await db
    .update(sessions)
    .set({ expiresAt: new Date(now + SESSION_DURATION_MS), ...(touch ? { lastSeenAt: new Date(now) } : {}) })
    .where(eq(sessions.tokenHash, tokenHash));

  if (missesMfa(row, role)) return { status: "mfa_required", userId: row.userId, role };
  return {
    status: "authenticated",
    user: {
      id: row.userId,
      email: row.email,
      role,
      organizationId: row.operator ? null : row.organizationId,
      language: row.language,
      firstStepsHidden: row.firstStepsHidden,
      mfaEnabled: row.mfaVerified,
      sessionId: row.sessionId,
    },
  };
}

// Lot 23 (ADR 0060) : l'auteur d'une écriture en base, d'après la session de la requête. Lecture
// seule. Une session expirée, retirée ou qui attend la double authentification n'a pas d'auteur.
export async function findSessionActor(db: AppDatabase, sessionToken: string | undefined): Promise<{ kind: "member" | "admin"; id: string } | null> {
  if (!sessionToken) return null;
  const row = await readSession(db, hashSessionToken(sessionToken));
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  const role = sessionRole(row);
  if (!role || missesMfa(row, role)) return null;
  return { kind: role === "admin" ? "admin" : "member", id: row.userId };
}

// HUB-02 : organisations où le compte a une adhésion active, pour le sélecteur.
export async function listOrganizations(db: AppDatabase, userId: string): Promise<{ organizationId: string; name: string; role: MembershipRole }[]> {
  return db
    .select({ organizationId: organizations.id, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.disabledAt)))
    .orderBy(asc(organizations.name));
}

// HUB-02 : passer sur une autre organisation. Refusé (false), sans distinguer « inexistante » et
// « sans adhésion » (SEC-13), si le compte n'y a pas d'adhésion active.
export async function switchOrganization(db: AppDatabase, sessionToken: string, organizationId: string): Promise<boolean> {
  const tokenHash = hashSessionToken(sessionToken);
  const [session] = await db.select({ userId: sessions.userId }).from(sessions).where(eq(sessions.tokenHash, tokenHash));
  if (!session) return false;
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, session.userId), eq(memberships.organizationId, organizationId), isNull(memberships.disabledAt)));
  if (!membership) return false;
  await db.update(sessions).set({ organizationId }).where(eq(sessions.tokenHash, tokenHash));
  return true;
}

export async function destroySession(db: AppDatabase, sessionToken: string): Promise<void> {
  const tokenHash = hashSessionToken(sessionToken);
  const [closed] = await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .returning({ userId: sessions.userId, organizationId: sessions.organizationId });
  if (!closed) return;
  const [user] = await db.select({ operator: users.operator }).from(users).where(eq(users.id, closed.userId));
  await journalConnection(db, { id: closed.userId, organizationId: closed.organizationId, role: user?.operator ? "admin" : "member" }, "hub.session.closed");
}

// D4 (lot 33) : adresse du compte et son identifiant chez le fournisseur, pour exiger la double
// authentification chez lui et renvoyer un lien de connexion.
export async function accountIdentity(db: AppDatabase, userId: string): Promise<{ email: string; idpSubject: string | null } | null> {
  const [user] = await db.select({ email: users.email, idpSubject: users.idpSubject }).from(users).where(eq(users.id, userId));
  return user ?? null;
}

export async function setUserLanguage(db: AppDatabase, userId: string, language: "fr" | "en"): Promise<void> {
  await db.update(users).set({ language }).where(eq(users.id, userId));
}
