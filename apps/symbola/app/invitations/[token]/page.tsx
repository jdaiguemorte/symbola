import { AcceptInvitationForm } from "./form";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main>
      <h1>Bienvenue sur Symbola</h1>
      <AcceptInvitationForm token={token} />
    </main>
  );
}
