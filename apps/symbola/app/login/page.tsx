// Lot 33 (SEC-01, SEC-07, HUB-01, ADR 0067, décision D5) — connexion : lien magique envoyé par
// Symbola, ou page du fournisseur d'identité (mot de passe, clé d'accès). Messages de retour
// (lien échu, accès retiré, échec) par un code dans l'adresse, jamais une donnée personnelle.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { LinkRequestForm } from "./link-request-form";

const NOTICES = { lien: { invalide: "linkInvalid" }, acces: { refuse: "accessRefused" }, erreur: { connexion: "failed" } } as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("Login");
  const tHelp = await getTranslations("Help");
  const query = await searchParams;
  const notice =
    (query.lien === "invalide" && NOTICES.lien.invalide) || (query.acces === "refuse" && NOTICES.acces.refuse) || (query.erreur === "connexion" && NOTICES.erreur.connexion) || null;
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("login.title")} body={tHelp("login.body")} />
      {notice ? <p role="alert">{t(notice)}</p> : null}
      <p>{t("intro")}</p>
      <LinkRequestForm namespace="Login" />
      <p>
        {t("providerPrompt")} <a href="/auth/connexion">{t("providerLink")}</a>
      </p>
      <p>
        {t("signupPrompt")} <Link href="/inscription">{t("signupLink")}</Link>
      </p>
    </main>
  );
}
