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
  "requirePlanner",
  "requireOwner",
  "requireAdmin",
  // Lot 26a (SEC-14) : portail d'un lien personnel (lib/guards.ts, lib/link-session.ts)
  "requireLink",
  "currentLinkAccess",
  // lib/auth-context.ts
  "getAuthContext",
  "getPlannerAuthContext",
  // @symbola/auth : connexion en cours, avant la double authentification
  "requireUser",
];

// Accès communs (fichier où chacun est défini) : ils appellent eux-mêmes une garde.
const SHARED_ACCESS: Record<string, string> = {
  authorizedPlanner: "app/devis/planner-access.ts",
  ownerContext: "app/rgpd/owner-access.ts",
  receiveUpload: "lib/uploads/receive.ts",
  importStepContext: "app/import/step-context.ts",
  vendorSettingsAccess: "app/prestataires/parametres/guard.ts",
};

const GUARDS = new Set([...BASE_GUARDS, ...Object.keys(SHARED_ACCESS)]);

// Entrées publiques (« fichier#fonction exportée ») : ouvertes sans session,
// chacune protégée autrement, ou sans donnée.
const PUBLIC_ENTRIES: Record<string, string> = {
  "login/page.tsx#default": "connexion",
  "login/actions.ts#loginAction": "connexion, limitée en débit",
  "logout-action.ts#logoutAction": "déconnexion : ferme la session du cookie, s'il y en a une",
  "mfa/page.tsx#default": "double authentification d'une connexion en cours",
  "mot-de-passe-oublie/page.tsx#default": "demande de réinitialisation",
  "mot-de-passe-oublie/actions.ts#forgotPasswordAction": "demande de réinitialisation, limitée en débit",
  "mot-de-passe/[token]/page.tsx#default": "jeton de réinitialisation",
  "mot-de-passe/[token]/actions.ts#resetPasswordAction": "jeton de réinitialisation",
  "invitations/[token]/page.tsx#default": "jeton d'invitation de l'équipe",
  "invitations/[token]/actions.ts#acceptInvitationAction": "jeton d'invitation de l'équipe",
  // Lot 26a (UX-11, SEC-14, SEC-15, SEC-17 ; ADR 0053).
  "lien/page.tsx#default": "arrivée d'un lien personnel : le jeton reste dans le navigateur, la page n'affiche rien d'autre",
  "lien/actions.ts#openLinkAction": "jeton du lien personnel, vérifié haché sous RLS, limité en débit",
  "lien/actions.ts#requestLinkRenewalAction": "jeton d'un lien expiré, même réponse dans tous les cas, limitée en débit",
  // Lot 26b (POR-01, D6).
  "lien/actions.ts#verifyLinkCodeAction": "jeton du lien et code à usage unique, vérifiés hachés sous RLS, cinq essais, limitée en débit",
  "portail/actions.ts#closeLinkSessionAction": "ferme la session de lien du cookie, s'il y en a une",
  "signature-fictive/[token]/page.tsx#default": "jeton du signataire (fournisseur fictif, hors production)",
  "signature-fictive/[token]/actions.ts#fakeSignatureAction": "jeton du signataire (fournisseur fictif, hors production)",
  "import/[importId]/ecarts/page.tsx#default": "redirection vers l'étape en cours, elle-même gardée",
  "aide/actions.ts#setAutoToursAction": "préférence d'affichage dans un cookie, sans donnée",
  "health/route.ts#GET": "sonde de santé, sans donnée",
  "api/webhooks/signature/route.ts#POST": "webhook du fournisseur de signature, authentifié par son secret partagé",
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

  it("l'analyse voit chaque page, chaque route et chaque action exportée", () => {
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

  it("chaque page appelle une garde, ou figure parmi les entrées publiques", () => {
    expect(unguarded("page")).toEqual([]);
  });

  it("chaque méthode de chaque route appelle une garde, ou figure parmi les entrées publiques", () => {
    expect(unguarded("route")).toEqual([]);
  });

  it("chaque action serveur appelle une garde, ou figure parmi les entrées publiques", () => {
    expect(unguarded("action")).toEqual([]);
  });

  it("la liste des entrées publiques ne garde aucune entrée disparue, et chacune a son motif", () => {
    const keys = new Set(appEntries().map((entry) => entry.key));
    expect(Object.keys(PUBLIC_ENTRIES).filter((key) => !keys.has(key))).toEqual([]);
    expect(Object.values(PUBLIC_ENTRIES).filter((reason) => reason.trim().length < 5)).toEqual([]);
  });

  it("le webhook public authentifie l'appel par le secret du fournisseur", () => {
    const source = readFileSync(join(APP_DIR, "api/webhooks/signature/route.ts"), "utf8");
    expect(source).toContain("handleSignatureWebhook(");
  });
});
