import Link from "next/link";
import { createAppConnection } from "@symbola/db/client";
import { isModuleEnabled, listOrganizations, MODULE_KEYS } from "@/modules/hub/service";
import { requireAdmin } from "@/lib/require-admin";
import { AdminOrganizationForm } from "./organization-form";
import { toggleModuleAction } from "./actions";

export default async function AdminPage() {
  await requireAdmin();

  const { sql, db } = createAppConnection();
  let organizationsWithModules;
  try {
    const organizations = await listOrganizations(db);
    organizationsWithModules = await Promise.all(
      organizations.map(async (organization) => ({
        ...organization,
        modules: await Promise.all(
          MODULE_KEYS.map(async (moduleKey) => ({
            moduleKey,
            enabled: await isModuleEnabled(db, organization.id, moduleKey),
          })),
        ),
      })),
    );
  } finally {
    await sql.end();
  }

  return (
    <main>
      <h1>Administration</h1>
      <p>
        <Link href="/admin/health">Voir la page Santé</Link>
      </p>
      <h2>Créer une organisation</h2>
      <AdminOrganizationForm />

      <h2>Organisations</h2>
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Modules</th>
          </tr>
        </thead>
        <tbody>
          {organizationsWithModules.map((organization) => (
            <tr key={organization.id}>
              <td>{organization.name}</td>
              <td>
                {organization.modules.map(({ moduleKey, enabled }) => (
                  <form action={toggleModuleAction} key={moduleKey} style={{ display: "inline" }}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <input type="hidden" name="moduleKey" value={moduleKey} />
                    <input type="hidden" name="enabled" value={(!enabled).toString()} />
                    <button type="submit">
                      {moduleKey} : {enabled ? "activé" : "désactivé"} (
                      {enabled ? "désactiver" : "activer"})
                    </button>
                  </form>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
