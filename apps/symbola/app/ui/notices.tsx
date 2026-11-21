// Lot 62a (UX-13) — messages d'erreur et d'attention (DESIGN.md, « Messages »). Le texte dit d'abord
// ce que c'est (« Erreur : », « À vérifier : ») : la couleur seule ne suffit pas (NFR-17). Une
// confirmation ou une information reste un simple `<p className="notice" role="status">`.
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/** Une action a échoué : fond `critical-soft`, annoncé aussitôt aux lecteurs d'écran. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  return (
    <p className="notice notice-error" role="alert">
      <strong>{t("errorLabel")}</strong> {children}
    </p>
  );
}

/** Rien n'a échoué, mais quelque chose est à vérifier avant de continuer : fond `attention-soft`. */
export function AttentionNotice({ children }: { children: ReactNode }) {
  const t = useTranslations("Common");
  return (
    <p className="notice notice-attention" role="status">
      <strong>{t("attentionLabel")}</strong> {children}
    </p>
  );
}
