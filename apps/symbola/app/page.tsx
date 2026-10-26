import { redirect } from "next/navigation";
import { getGreeting } from "@/modules/hello/service";
import { getAuthContext } from "@/lib/auth-context";
import { logoutAction } from "./logout-action";

export default async function HomePage() {
  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  const greeting = getGreeting();

  return (
    <main>
      <h1>Symbola</h1>
      <p>Connecté comme {auth.user.email}</p>
      <p>{greeting.message}</p>
      <form action={logoutAction}>
        <button type="submit">Se déconnecter</button>
      </form>
    </main>
  );
}
