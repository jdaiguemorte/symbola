// Lot 24a (SEC-12) — chaque page, route et action serveur a sa règle d'accès,
// contrôlée côté serveur à chaque requête. Analyse statique par le compilateur
// TypeScript : la fonction exportée (page, méthode HTTP, action) appelle une
// garde, directement ou par une fonction de son fichier, ou un accès commun qui
// en appelle une ; sinon elle figure dans la liste des entrées publiques, avec
// son motif. Une entrée ajoutée sans règle fait échouer le test. Remplace le
// contrôle des pages du lot 16 (L16-ARC-01), qui cherchait un appel n'importe
// où dans le fichier.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const APP_DIR = join(ROOT, "app");

// Gardes de base : elles lisent la session, le rôle et l'organisation.
const BASE_GUARDS = [
  // lib/guards.ts
  "requireSignedIn",
  "requirePendingMfa",
  "requirePlanner",
  "requireOwner",
  "requireOperator",
  // Lot 26a (SEC-14) : portail d'un lien personnel (lib/guards.ts, lib/link-session.ts)
  "requireLink",
  "currentLinkAccess",
  // lib/auth-context.ts
  "getAuthContext",
  "getPlannerAuthContext",
  // @symbola/auth : connexion en cours, avant la double authentification
  "requireUser",
  // Lot 52 (HUB-04, HUB-05, EVT-06 ; ADR 0094) : lecture comptable, Comptable, « Mes sessions », page
  // publique qui s'adapte à une personne connectée, et qui ouvre le mode Jour J (équipe ou renfort).
  "requireAccountingReader",
  "requireAccountant",
  "requireAccountSession",
  "optionalSignedIn",
  "resolveDayOfViewer",
];

// Accès communs (fichier où chacun est défini) : ils appellent eux-mêmes une garde.
const SHARED_ACCESS: Record<string, string> = {
  authorizedPlanner: "app/devis/planner-access.ts",
  ownerContext: "app/rgpd/owner-access.ts",
  receiveUpload: "lib/uploads/receive.ts",
  // Lot 47 (PRE-04) : envoi d'un fichier par le lien d'un prestataire (session du lien, débit, taille).
  receiveLinkUpload: "lib/uploads/receive.ts",
  importStepContext: "app/import/step-context.ts",
  vendorSettingsAccess: "app/prestataires/parametres/guard.ts",
  // Lot 49 : module Invités, côté équipe (session, modules) et au portail (lien, rubrique, modules).
  guestsAccess: "app/events/[id]/invites/access.ts",
  portalGuestsAccess: "app/portail/invites/access.ts",
  // Lot 46 : la planner connectée, et le module Rendez-vous ouvert.
  appointmentsPlanner: "app/rendez-vous/access.ts",
  // Lot 51 : le jour J de terrain (session de l'équipe, module, évènement ouvert au jour J, origine).
  dayOfAccess: "app/jour-j/[eventId]/access.ts",
  // Lot 45 : la rubrique « Questionnaires » du portail (lien, rubrique ouverte, module Évènements).
  portalQuestionnairesAccess: "app/portail/questionnaires/access.ts",
  // Lot 52 : PDF des factures et avoirs, e-reporting, écritures, aussi pour le Comptable (lecture).
  authorizedAccountingReader: "app/devis/planner-access.ts",
  // Lot 55 : messagerie d'un lien (session du lien au public attendu, débit, taille ; le service relit
  // le lien, sa rubrique et ses sujets).
  linkReply: "lib/messages/link-routes.ts",
  linkNewTopic: "lib/messages/link-routes.ts",
  linkAttachment: "lib/messages/link-routes.ts",
  // Lot 60 : plans de salle côté équipe (session, modules, visibilité de l'évènement) et par un lien
  // (session du lien, rubrique ou statut retenu, modules).
  floorplansAccess: "app/plans-de-salle/access.ts",
  layoutAccess: "app/plans-de-salle/access.ts",
  linkFloorplanAccess: "app/plans-de-salle/link-access.ts",
  sharedFloorplanPdfResponse: "app/plans-de-salle/link-access.ts",
  sharedFloorplanBackgroundResponse: "app/plans-de-salle/link-access.ts",
  // Lot 71b : la page de reprise (session, organisation, rôle, module Évènements, ce que voit la personne).
  requireTakeoverActor: "app/reprise/access.ts",
  takeoverActorForAction: "app/reprise/access.ts",
};

const GUARDS = new Set([...BASE_GUARDS, ...Object.keys(SHARED_ACCESS)]);

// Entrées publiques (« fichier#fonction exportée ») : ouvertes sans session,
// chacune protégée autrement, ou sans donnée.
const PUBLIC_ENTRIES: Record<string, string> = {
  // Lot 33 (SEC-01, SEC-07, HUB-01 ; ADR 0067) : connexion par le fournisseur d'identité.
  "login/page.tsx#default": "connexion : demande d'un lien, ou page du fournisseur d'identité",
  "login/actions.ts#requestLinkAction": "demande d'un lien de connexion ou d'inscription : même réponse pour toute adresse, limitée en débit, piège à robots",
  "inscription/page.tsx#default": "inscription libre : une adresse e-mail, sans donnée",
  "auth/connexion/route.ts#GET": "demande d'autorisation poussée au fournisseur d'identité, sans donnée",
  "auth/lien/[lien]/route.ts#GET": "lien magique scellé ; le fournisseur juge le jeton (usage unique, quinze minutes)",
  "auth/callback/route.ts#GET": "retour du fournisseur : état, nonce et PKCE vérifiés, jeton d'identité vérifié par openid-client",
  "logout-action.ts#logoutAction": "déconnexion : ferme la session du cookie, s'il y en a une, puis celle du fournisseur",
  "invitations/[token]/page.tsx#default": "jeton d'invitation de l'équipe",
  "invitations/[token]/actions.ts#acceptInvitationAction": "jeton d'invitation de l'équipe ; le lien de connexion part à l'adresse invitée",
  // Lot 26a (UX-11, SEC-14, SEC-15, SEC-17 ; ADR 0053).
  "lien/page.tsx#default": "arrivée d'un lien personnel : le jeton reste dans le navigateur, la page n'affiche rien d'autre",
  "lien/actions.ts#openLinkAction": "jeton du lien personnel, vérifié haché sous RLS, limité en débit",
  "lien/actions.ts#requestLinkRenewalAction": "jeton d'un lien expiré, même réponse dans tous les cas, limitée en débit",
  // Lot 26b (POR-01, D6).
  "lien/actions.ts#verifyLinkCodeAction": "jeton du lien et code à usage unique, vérifiés hachés sous RLS, cinq essais, limitée en débit",
  // Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) : flux de calendrier abonné par un agenda, sans session.
  "calendrier/[jeton]/route.ts#GET": "adresse secrète d'un flux de calendrier : jeton vérifié haché sous RLS, compte toujours dans l'équipe, lecture seule, limitée en débit",
  "portail/actions.ts#closeLinkSessionAction": "ferme la session de lien du cookie, s'il y en a une",
  "signature-fictive/[token]/page.tsx#default": "jeton du signataire (fournisseur fictif, hors production)",
  "signature-fictive/[token]/actions.ts#fakeSignatureAction": "jeton du signataire (fournisseur fictif, hors production)",
  "import/[importId]/ecarts/page.tsx#default": "redirection vers l'étape en cours, elle-même gardée",
  "aide/actions.ts#setAutoToursAction": "préférence d'affichage dans un cookie, sans donnée",
  "health/route.ts#GET": "sonde de santé, sans donnée",
  // Lot 63c (ADR 0107) : l'emplacement du panneau des réglages, vide hors d'une navigation interceptée.
  "@panel/[...catchAll]/page.tsx#default": "emplacement vide du panneau des réglages : ne rend rien, sans donnée",
  // Lot 29a (ARC-09, D6) : servie par le service worker sans réseau.
  "hors-ligne/page.tsx#default": "page « Hors ligne » : aucune donnée du serveur, seulement les copies gardées sur l'appareil",
  "icons/[name]/route.ts#GET": "icônes de l'application installée, sans donnée",
  "manifest.webmanifest/route.ts#GET": "manifeste de l'application installable : nom, couleurs et icônes de la marque, sans donnée",
  "api/webhooks/signature/route.ts#POST": "webhook du fournisseur de signature, authentifié par son secret partagé",
  // Lot 40b (Q27, ADR 0077) : l'écran d'erreur peut s'afficher sans session (page publique, lien personnel).
  "api/erreurs/route.ts#POST": "relais des erreurs du navigateur vers le suivi : même origine, débit limité par adresse IP, taille bornée, champs triés, rien de gardé",
  // Lot 37a (DOC-04, D7 ; ADR 0070) : lien de partage d'un document, pour une personne sans lien personnel.
  "partage/page.tsx#default": "arrivée d'un lien de partage : le jeton reste dans le navigateur, la page n'affiche rien d'autre",
  "partage/actions.ts#describeShareLinkAction": "jeton du lien de partage, vérifié haché sous RLS, limité en débit ; l'intitulé seul, même réponse pour un lien inconnu, expiré ou révoqué",
  // Lot 44 (CRM-01 ; D1, D2, D4 ; ADR 0084) : formulaire de contact public, sans compte.
  "contact/[adresse]/page.tsx#default": "formulaire de contact public : l'adresse désigne un formulaire ouvert (sinon « introuvable »), rien de personnel n'est affiché",
  "contact/[adresse]/cadre/page.tsx#default": "même formulaire, encadrable par les seuls sites déclarés (frame-ancestors) ; « introuvable » sinon",
  "contact/[adresse]/actions.ts#submitContactAction": "envoi du formulaire public : adresse d'un formulaire ouvert, piège à robots, délai scellé, débit limité par adresse IP et par organisation ; même réponse qu'un succès si la garde refuse",
  // Lot 49 (INV-03, SEC-14 à SEC-17 ; ADR 0053, 0081) : page de réponse d'un invité, sans compte.
  "rsvp/page.tsx#default": "arrivée d'un lien d'invité : le jeton reste dans le navigateur, la page n'affiche rien avant l'échange",
  "rsvp/actions.ts#openRsvpAction": "jeton du lien de l'invité, vérifié haché sous RLS, module ouvert, limité en débit ; « lien inconnu » sinon",
  "rsvp/actions.ts#answerRsvpAction": "jeton du lien de l'invité, relu à chaque envoi ; seuls son foyer et ses droits (répondant, régimes avec accord), limité en débit",
  "rsvp/actions.ts#opposeRsvpAction": "jeton du lien de l'invité : efface ses propres coordonnées et régimes, limité en débit",
  "partage/fichier/route.ts#POST": "jeton du lien de partage en POST du même site, vérifié haché sous RLS, limité en débit ; son document seul, l'ouverture journalisée",
  // Lot 46 (RDV-02, RDV-03 ; D5, D11 ; ADR 0082) : page publique de réservation et lien de gestion d'un rendez-vous.
  "reserver/[adresse]/page.tsx#default": "page publique de réservation : adresse lisible choisie par la planner, page active et module ouvert, sinon introuvable ; créneaux libres seulement, aucune donnée personnelle",
  "reserver/[adresse]/actions.ts#bookAppointmentAction": "réservation sans compte : entrée validée, piège à robots, débit limité par adresse IP et par adresse e-mail, trois rendez-vous à venir par adresse, même réponse au plafond qu'au débit",
  "rdv/page.tsx#default": "arrivée d'un lien de gestion : le jeton reste dans le navigateur, la page n'affiche rien d'autre",
  "rdv/actions.ts#describeAppointmentLinkAction": "jeton du lien de gestion, vérifié haché sous RLS, valable jusqu'à la fin du rendez-vous, limité en débit ; même réponse pour un lien inconnu, expiré ou retiré",
  "rdv/actions.ts#appointmentLinkSlotsAction": "jeton du lien de gestion : créneaux libres du même type seulement, limité en débit",
  "rdv/actions.ts#rescheduleAppointmentAction": "jeton du lien de gestion : report sur un créneau libre recalculé sous verrou, limité en débit",
  // Lot 52 (SEC-08, D6 ; ADR 0094).
  "api/webhooks/identite/route.ts#POST": "webhook du fournisseur d'identité, authentifié par la signature HMAC de son corps (clé lue par l'API d'administration), refusé et journalisé sinon",
  "securite/pas-moi/page.tsx#default": "« Ce n'est pas moi » : le jeton reste dans le navigateur, la page n'affiche rien d'autre",
  "securite/actions.ts#disownDeviceAction": "jeton « Ce n'est pas moi » en POST, vérifié haché, usage unique, sept jours, limité en débit ; ferme seulement les sessions du compte de l'alerte",
  // Lot 55 (MSG-05, SEC-19, POR-11 ; ADR 0102).
  "api/webhooks/envois/route.ts#POST": "webhook de remise du service d'envoi, authentifié par la signature horodatée de son corps (adaptateur du service), refusé et journalisé sinon ; une référence inconnue ne change rien",
  "portail/manifeste/[organisation]/route.ts#GET": "manifeste du portail installable : nom et couleur d'une organisation désignée par son identifiant (non devinable), sans donnée personnelle ; manifeste de Symbola pour un identifiant inconnu",
  "portail/manifeste/[organisation]/icone/route.ts#GET": "icône du portail installé : le logo d'une organisation désignée par son identifiant (non devinable), celui de ses documents et e-mails ; l'icône de Symbola sinon",
  "rdv/actions.ts#cancelAppointmentByLinkAction": "jeton du lien de gestion : annulation de ce rendez-vous seul, motif choisi dans une liste, limité en débit",
};

const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

type Parsed = { functions: Map<string, ts.Node>; exported: string[]; usesServer: boolean };

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

// Fonctions de premier niveau du fichier (déclarations et constantes), et noms exportés.
function parse(fileName: string, text: string): Parsed {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const functions = new Map<string, ts.Node>();
  const exported: string[] = [];
  const first = source.statements[0];
  const usesServer = first !== undefined && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
  for (const statement of source.statements) {
    const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
      if (statement.name) functions.set(statement.name.text, statement.body);
      if (isDefault) functions.set("default", statement.body);
      if (isExported) exported.push(isDefault ? "default" : statement.name!.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !init || !(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue;
        functions.set(declaration.name.text, init.body);
        if (isExported) exported.push(declaration.name.text);
      }
    } else if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
      const target = functions.get(statement.expression.text);
      if (target) functions.set("default", target);
      exported.push("default");
    }
  }
  return { functions, exported, usesServer };
}

function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) names.add(child.expression.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

// Fonctions du fichier qui appellent une garde, directement ou par une autre
// fonction du même fichier.
function guardedFunctions(parsed: Parsed, guards: Set<string>): Set<string> {
  const calls = [...parsed.functions].map(([name, body]) => [name, calledNames(body)] as const);
  const guarded = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, called] of calls) {
      if (guarded.has(name)) continue;
      if ([...called].some((callee) => guards.has(callee) || guarded.has(callee))) {
        guarded.add(name);
        changed = true;
      }
    }
  }
  return guarded;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

type Entry = { key: string; kind: "page" | "route" | "action"; guarded: boolean };

function appEntries(): Entry[] {
  return sourceFiles(APP_DIR).flatMap((path) => {
    const file = relative(APP_DIR, path);
    const name = file.split("/").pop()!;
    const parsed = parse(path, readFileSync(path, "utf8"));
    const guarded = guardedFunctions(parsed, GUARDS);
    const kind = name === "page.tsx" ? "page" : name === "route.ts" ? "route" : parsed.usesServer ? "action" : null;
    if (kind === null) return [];
    const names = parsed.exported.filter((exported) =>
      kind === "page" ? exported === "default" : kind === "route" ? HTTP_METHODS.has(exported) : true,
    );
    return names.map((exported) => ({ key: `${file}#${exported}`, kind, guarded: guarded.has(exported) }));
  });
}

function unguarded(kind: Entry["kind"]): string[] {
  return appEntries()
    .filter((entry) => entry.kind === kind && !entry.guarded && !(entry.key in PUBLIC_ENTRIES))
    .map((entry) => entry.key);
}

describe("SEC-12 — Chaque route a sa règle d'accès, vérifiée côté serveur", () => {
  it("l'analyse repère une action sans garde, et accepte une garde appelée par une fonction du fichier", () => {
    const parsed = parse(
      "actions.ts",
      `"use server";
      async function context() { return getPlannerAuthContext(); }
      export async function guardedAction() { const auth = await context(); return auth; }
      export async function openAction() { return deleteEverything(); }
      export const arrowAction = async () => { await requireOwner(); };`,
    );
    expect(parsed.usesServer).toBe(true);
    expect(parsed.exported).toEqual(["guardedAction", "openAction", "arrowAction"]);
    expect([...guardedFunctions(parsed, GUARDS)].sort()).toEqual(["arrowAction", "context", "guardedAction"]);
  });

  // Lot 53 : délai explicite. Le test lit et analyse toutes les sources de l'app ; sa durée croît avec
  // chaque lot et a dépassé les 5 s par défaut en CI (5 057 ms, PR #148). Rien de ce qu'il vérifie ne
  // change.
  it("l'analyse voit chaque page, chaque route et chaque action exportée", { timeout: 30_000 }, () => {
    const files = sourceFiles(APP_DIR).map((path) => ({ name: path.split("/").pop()!, text: readFileSync(path, "utf8") }));
    const entries = appEntries();
    const count = (kind: Entry["kind"]) => entries.filter((entry) => entry.kind === kind).length;
    expect(count("page")).toBe(files.filter((file) => file.name === "page.tsx").length);
    const methods = files
      .filter((file) => file.name === "route.ts")
      .reduce((total, file) => total + (file.text.match(/^export (async function|const) (GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/gm) ?? []).length, 0);
    expect(count("route")).toBe(methods);
    const actions = files
      .filter((file) => file.text.startsWith('"use server"'))
      .reduce((total, file) => total + (file.text.match(/^export (async function|const) /gm) ?? []).length, 0);
    expect(count("action")).toBe(actions);
    expect(count("action")).toBeGreaterThan(150);
  });

  it("chaque accès commun appelle lui-même une garde de base", () => {
    for (const [name, file] of Object.entries(SHARED_ACCESS)) {
      const parsed = parse(file, readFileSync(join(ROOT, file), "utf8"));
      expect(guardedFunctions(parsed, new Set(BASE_GUARDS)).has(name), `${name} (${file})`).toBe(true);
    }
  });

  it("chaque page appelle une garde, ou figure parmi les entrées publiques", { timeout: 30_000 }, () => {
    expect(unguarded("page")).toEqual([]);
  });

  it("chaque méthode de chaque route appelle une garde, ou figure parmi les entrées publiques", { timeout: 30_000 }, () => {
    expect(unguarded("route")).toEqual([]);
  });

  it("chaque action serveur appelle une garde, ou figure parmi les entrées publiques", { timeout: 30_000 }, () => {
    expect(unguarded("action")).toEqual([]);
  });

  // Même parcours de toutes les routes que les tests voisins : même limite (lent sous la couverture).
  it("la liste des entrées publiques ne garde aucune entrée disparue, et chacune a son motif", { timeout: 30_000 }, () => {
    const keys = new Set(appEntries().map((entry) => entry.key));
    expect(Object.keys(PUBLIC_ENTRIES).filter((key) => !keys.has(key))).toEqual([]);
    expect(Object.values(PUBLIC_ENTRIES).filter((reason) => reason.trim().length < 5)).toEqual([]);
  });

  it("le webhook public authentifie l'appel par le secret du fournisseur", () => {
    const source = readFileSync(join(APP_DIR, "api/webhooks/signature/route.ts"), "utf8");
    expect(source).toContain("handleSignatureWebhook(");
  });
});
