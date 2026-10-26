import { redirect } from "next/navigation";
import { MfaForm } from "./mfa-form";
import { getMfaSetupState } from "./actions";

export default async function MfaPage() {
  const state = await getMfaSetupState();
  if (!state) redirect("/login");

  return (
    <main>
      <h1>Double authentification</h1>
      {state.provisioningUri ? (
        <>
          <p>Scannez ce code dans votre application d'authentification :</p>
          <code>{state.provisioningUri}</code>
        </>
      ) : (
        <p>Saisissez le code de votre application d'authentification.</p>
      )}
      <MfaForm />
    </main>
  );
}
