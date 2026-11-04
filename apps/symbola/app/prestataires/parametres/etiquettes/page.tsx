// Lot 11 (PRE-05) — étiquettes du carnet (bio, navette, coup de cœur…).
import { getTranslations } from "next-intl/server";
import { listVendorTags } from "@/modules/vendors/service";
import { removeVendorTagAction } from "../../actions";
import { vendorSettingsAccess } from "../guard";
import { CreateTagForm } from "../settings-forms";

export default async function VendorTagsPage() {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorBook");
  if (!enabled) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const tags = await listVendorTags(organizationId);
  return (
    <main>
      <h1>{t("settingsTagsTitle")}</h1>
      <p>{t("settingsTagsIntro")}</p>
      {tags.length === 0 ? <p>{t("tagsEmpty")}</p> : null}
      <ul>
        {tags.map((tag) => (
          <li key={tag.id}>
            <span className="badge">{tag.label}</span>
            <form action={removeVendorTagAction} className="inline-form">
              <input type="hidden" name="tagId" value={tag.id} />
              <button type="submit">{t("tagRemove", { tag: tag.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <CreateTagForm />
    </main>
  );
}
