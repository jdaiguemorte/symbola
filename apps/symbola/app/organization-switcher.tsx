// Lot 33 (HUB-02, D6) — organisation ouverte, et passage à une autre quand le compte en a
// plusieurs ; création d'une autre organisation (son propre démarrage).
import { getTranslations } from "next-intl/server";
import { createOrganizationAction, switchOrganizationAction } from "./organisation-actions";

export async function OrganizationSwitcher({ organizations, current }: { organizations: { organizationId: string; name: string }[]; current: string | null }) {
  const t = await getTranslations("Organizations");
  return (
    <div className="organization-switcher">
      {organizations.length > 1 ? (
        <form action={switchOrganizationAction} className="inline-form compact-form">
          <label>
            {t("label")}
            <select name="organizationId" defaultValue={current ?? undefined}>
              {organizations.map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-ghost">
            {t("switch")}
          </button>
        </form>
      ) : null}
      <form action={createOrganizationAction}>
        <button type="submit" className="button-ghost">
          {t("create")}
        </button>
      </form>
    </div>
  );
}
