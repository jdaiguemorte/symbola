// Lot 33 (D4, ADR 0067) — la Propriétaire et l'Exploitation se connectent avec une double
// authentification. Sans elle, cette page : l'installer dans le centre de compte du fournisseur
// d'identité (application d'authentification ou clé d'accès), puis se reconnecter.
import { getTranslations } from "next-intl/server";
import { parseEnv } from "@symbola/env";
import { requirePendingMfa } from "@/lib/guards";
import { logoutAction } from "@/app/logout-action";

export default async function SecurityPage() {
  const pending = await requirePendingMfa();
  const t = await getTranslations("Security");
  const accountCenter = `${parseEnv(process.env).LOGTO_ENDPOINT.replace(/\/+$/, "")}/account/security`;
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t(pending.role === "admin" ? "operatorBody" : "ownerBody")}</p>
      <p>
        <a className="button" href={accountCenter}>
          {t("setUp")}
        </a>
      </p>
      <p>
        <a href="/auth/connexion">{t("signInAgain")}</a>
      </p>
      <form action={logoutAction}>
        <button type="submit" className="button-ghost">
          {t("signOut")}
        </button>
      </form>
    </main>
  );
}
