// Lot 33 (SEC-01, ADR 0067) — réglage du fournisseur d'identité (Logto) en une commande, rejouable :
//   pnpm --filter @symbola/auth configure-identity
// Après le bootstrap (base dédiée) et le premier démarrage de Logto (qui initialise sa base).
//
// 0. Droit de connexion : le bootstrap retire CONNECT à PUBLIC sur la base dédiée ; les rôles de
//    connexion de Logto (logto_tenant_<base>_*) le reçoivent par leur rôle de base, créé à
//    l'initialisation de Logto (un CREATE ROLE simple : il ne peut pas exister avant). Logto
//    se rétablit seul dès que le droit est accordé.
// 1. Amorçage : une ligne SQL dans la base de Logto crée l'application machine à machine de
//    Symbola (identifiant LOGTO_M2M_APP_ID, secret LOGTO_M2M_SECRET) et lui donne le rôle
//    d'administration. C'est le seul accès direct à cette base ; il dépend de son schéma
//    interne (tables applications et applications_roles), rejoué à chaque montée de version.
// 2. Tout le reste par l'API d'administration : application web de Symbola, expérience de
//    connexion (e-mail, lien magique, clé d'accès, double authentification proposée par
//    Symbola, liste locale des mots de passe interdits), e-mails envoyés par Logto.
// Aucun secret affiché.
import postgres from "postgres";
import { z } from "zod";
import { createManagementClient } from "../src/identity/management";
import { accountCenter, forbiddenPasswordWords, signInExperience, smtpConnector, webApplication, WEB_APPLICATION_NAME } from "../src/identity/settings";

const env = z
  .object({
    POSTGRES_HOST: z.string().min(1).default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    LOGTO_DB_USER: z.string().min(1).default("logto"),
    LOGTO_DB_NAME: z.string().min(1).default("logto"),
    LOGTO_DB_PASSWORD: z.string().min(1, "LOGTO_DB_PASSWORD requis (bootstrap)"),
    LOGTO_ENDPOINT: z.string().url(),
    LOGTO_M2M_APP_ID: z.string().regex(/^[a-z0-9-]{1,21}$/).default("symbola-bootstrap"),
    LOGTO_M2M_SECRET: z.string().min(32, "LOGTO_M2M_SECRET : 32 caractères au moins (openssl rand -hex 32)"),
    APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().min(1).default("Symbola <no-reply@symbola.test>"),
    // Le serveur d'envoi vu du conteneur de Logto, s'il diffère de celui de l'app (en dev :
    // « mailpit » sur le réseau Docker, alors que l'app joint « localhost »).
    LOGTO_SMTP_HOST: z.string().min(1).optional(),
    LOGTO_SMTP_PORT: z.coerce.number().int().positive().optional(),
  })
  .parse(process.env);

// Identifiant de la ligne d'appartenance au rôle d'administration (21 caractères au plus).
const ROLE_LINK_ID = "symbolam2mmanagement1";
const MANAGEMENT_ROLE = "Logto Management API access";

async function waitForProvider(): Promise<void> {
  const discovery = `${env.LOGTO_ENDPOINT.replace(/\/+$/, "")}/oidc/.well-known/openid-configuration`;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const ok = await fetch(discovery).then((response) => response.ok).catch(() => false);
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`fournisseur d'identité injoignable : ${discovery}`);
}

const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;

function logtoDatabase() {
  return postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database: env.LOGTO_DB_NAME, username: env.LOGTO_DB_USER, password: env.LOGTO_DB_PASSWORD, max: 1 });
}

async function grantTenantConnect(): Promise<void> {
  const sql = logtoDatabase();
  const tenantRole = `logto_tenant_${env.LOGTO_DB_NAME}`;
  try {
    for (let attempt = 0; ; attempt += 1) {
      const [row] = await sql<[{ exists: boolean }]>`select exists(select 1 from pg_roles where rolname = ${tenantRole}) as exists`;
      if (row?.exists) break;
      if (attempt >= 45) throw new Error("Logto n'a pas initialisé sa base : est-il démarré ?");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await sql.unsafe(`grant connect on database ${quoteIdentifier(env.LOGTO_DB_NAME)} to ${quoteIdentifier(tenantRole)}`);
  } finally {
    await sql.end();
  }
}

async function bootstrapMachineApplication(): Promise<void> {
  const sql = logtoDatabase();
  try {
    const [role] = await sql<[{ id: string }?]>`select id from roles where tenant_id = 'default' and name = ${MANAGEMENT_ROLE}`;
    if (!role) throw new Error("rôle d'administration introuvable : Logto a-t-il démarré une première fois (initialisation de sa base) ?");
    await sql.begin(async (tx) => {
      await tx`
        insert into applications (tenant_id, id, name, secret, type, oidc_client_metadata)
        values ('default', ${env.LOGTO_M2M_APP_ID}, 'Symbola (amorçage)', ${env.LOGTO_M2M_SECRET}, 'MachineToMachine',
                ${tx.json({ redirectUris: [], postLogoutRedirectUris: [] })})
        on conflict (id) do update set secret = excluded.secret`;
      await tx`
        insert into applications_roles (tenant_id, id, application_id, role_id)
        values ('default', ${ROLE_LINK_ID}, ${env.LOGTO_M2M_APP_ID}, ${role.id})
        on conflict do nothing`;
    });
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  await grantTenantConnect();
  await waitForProvider();
  await bootstrapMachineApplication();
  console.log("Application machine à machine de Symbola prête.");

  const client = createManagementClient({ endpoint: env.LOGTO_ENDPOINT, m2mAppId: env.LOGTO_M2M_APP_ID, m2mSecret: env.LOGTO_M2M_SECRET });

  const wanted = webApplication(env.APP_PUBLIC_URL);
  const existing = await client.findWebApplication(WEB_APPLICATION_NAME);
  if (existing) {
    await client.request("PATCH", `/api/applications/${existing.id}`, { oidcClientMetadata: wanted.oidcClientMetadata });
  } else {
    await client.request("POST", "/api/applications", wanted);
  }
  console.log(`Application web « ${WEB_APPLICATION_NAME} » : retour sur ${wanted.oidcClientMetadata.redirectUris[0]}.`);

  // Logto exige un connecteur d'e-mail avant d'accepter l'inscription par e-mail.
  const smtpHost = env.LOGTO_SMTP_HOST ?? env.SMTP_HOST;
  const smtpPort = env.LOGTO_SMTP_PORT ?? env.SMTP_PORT;
  const config = smtpConnector({
    host: smtpHost,
    port: smtpPort,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    secure: smtpPort === 465,
  });
  const connectors = z.array(z.object({ id: z.string(), connectorId: z.string() })).parse(await client.request("GET", "/api/connectors"));
  const smtp = connectors.find((connector) => connector.connectorId === "simple-mail-transfer-protocol");
  if (smtp) {
    await client.request("PATCH", `/api/connectors/${smtp.id}`, { config });
  } else {
    await client.request("POST", "/api/connectors", { connectorId: "simple-mail-transfer-protocol", config });
  }
  console.log(`E-mails du fournisseur par ${smtpHost}:${smtpPort}.`);

  await client.request("PATCH", "/api/sign-in-exp", signInExperience(forbiddenPasswordWords()));
  console.log("Expérience de connexion réglée (e-mail, lien magique, clé d'accès, mots de passe interdits, sans appel sortant).");

  await client.request("PATCH", "/api/account-center", accountCenter());
  console.log("Centre de compte activé (mot de passe, clé d'accès, double authentification).");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
