import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAppConnection } from "@symbola/db/client";
import { getGreeting } from "@/modules/hello/service";
import { isModuleEnabled } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { recordUsage } from "@/lib/usage";
import { logoutAction } from "./logout-action";

export default async function HomePage() {
  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  // SOC-13, ADR 0016 : collecte brute des compteurs d'usage, au niveau de
  // cette page plutôt que dans lib/auth-context.ts (voir le commentaire
  // de ce fichier — importer next/server y cassait le flux de connexion).
  // after() planifie l'écriture après l'envoi de la réponse.
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    after(() => recordUsage(organizationId));
  }

  // Dégradation propre (CLAUDE.md §2.3) : un module désactivé par l'Admin
  // n'affiche jamais d'erreur, juste « indisponible ». L'Admin (pas
  // d'organisation) n'a pas de module à vérifier.
  let helloAvailable = true;
  if (auth.user.organizationId) {
    const organizationId = auth.user.organizationId;
    const { sql, db } = createAppConnection();
    try {
      helloAvailable = await isModuleEnabled(db, organizationId, "hello");
    } finally {
      await sql.end();
    }
  }
  const greeting = helloAvailable ? getGreeting() : null;

  return (
    <main>
      <h1>Symbola</h1>
      <p>Connecté comme {auth.user.email}</p>
      <p>{greeting ? greeting.message : "Module indisponible"}</p>
      <form action={logoutAction}>
        <button type="submit">Se déconnecter</button>
      </form>
    </main>
  );
}
