import { requireAdmin } from "@/lib/require-admin";
import { AdminOrganizationForm } from "./organization-form";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main>
      <h1>Administration</h1>
      <h2>Créer une organisation</h2>
      <AdminOrganizationForm />
    </main>
  );
}
