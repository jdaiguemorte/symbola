// Lot 11 (PRE-05) — étiquettes du carnet. Lot 20 (décision 5, ADR 0049) :
// rangées par groupe, rattachées à des familles, groupes « palier » à choix
// unique ; paliers repérés dans les étiquettes importées, à ranger d'un clic.
// Décision 3 : ajout en tête, liste filtrable, modification dans un panneau.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listVendorFamilies, listVendorTagGroups, listVendorTags, listVendorTagTierProposals } from "@/modules/vendors/service";
import { isValidId } from "@/app/events/module-access";
import { applyVendorTagTiersAction, removeVendorTagAction, removeVendorTagGroupAction } from "../../actions";
import { vendorSettingsAccess } from "../guard";
import { TagForm, TagGroupForm } from "../settings-forms";
import { ScreenHelp } from "@/app/screen-help";
import { ListFilter } from "@/app/ui/list-filter";
import { SidePanel } from "@/app/ui/side-panel";

const BASE = "/prestataires/parametres/etiquettes";

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("fr") + value.slice(1);
}

export default async function VendorTagsPage({ searchParams }: { searchParams: Promise<{ etiquette?: string }> }) {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorBook");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  if (!enabled) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [tags, groups, families, proposals] = await Promise.all([
    listVendorTags(organizationId),
    listVendorTagGroups(organizationId),
    listVendorFamilies(organizationId),
    listVendorTagTierProposals(organizationId),
  ]);
  const opened = (await searchParams).etiquette;
  const openedTag = opened && isValidId(opened) ? tags.find((tag) => tag.id === opened) : undefined;
  const familyLabel = new Map(families.map((family) => [family.id, family.label]));
  const familiesOf = (familyIds: string[]) => (familyIds.length === 0 ? t("tagFamiliesAll") : familyIds.map((id) => familyLabel.get(id) ?? "").filter(Boolean).join(", "));
  const sections = [
    ...groups.map((group) => ({ key: group.id, label: group.label, exclusive: group.exclusive, tags: tags.filter((tag) => tag.groupId === group.id) })),
    { key: "other", label: t("tagGroupOther"), exclusive: false, tags: tags.filter((tag) => tag.groupId === null) },
  ].filter((section) => section.tags.length > 0);

  return (
    <main>
      <h1>{t("settingsTagsTitle")}</h1>
      <ScreenHelp title={tHelp("vendorTags.title")} body={tHelp("vendorTags.body")} />
      <p>{t("settingsTagsIntro")}</p>

      {proposals.length > 0 ? (
        <section className="card" aria-labelledby="tier-proposals-title">
          <h2 id="tier-proposals-title">{t("tierProposalsTitle")}</h2>
          <p>{t("tierProposalsIntro")}</p>
          {proposals.map((proposal) => (
            <form key={proposal.unit} action={applyVendorTagTiersAction} className="tier-proposal">
              <input type="hidden" name="unit" value={proposal.unit} />
              <p>{t("tierProposalTags", { count: proposal.tags.length, unit: proposal.unit, labels: proposal.tags.map((tag) => tag.label).join(", ") })}</p>
              <label>
                {t("tagGroupNameLabel")}
                <input type="text" name="label" defaultValue={capitalize(proposal.unit)} required />
              </label>
              <button type="submit">{t("tierProposalApply")}</button>
            </form>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="tag-new-title">
        <h2 id="tag-new-title">{t("tagsNewTitle")}</h2>
        <TagForm groups={groups} families={families} />
      </section>

      <section aria-labelledby="tag-list-title">
        <h2 id="tag-list-title">{t("tagsListTitle")}</h2>
        {tags.length === 0 ? <p>{t("tagsEmpty")}</p> : null}
        <ListFilter targetId="vendor-tags-list" total={tags.length} />
        <div id="vendor-tags-list" className="tag-sections">
          {sections.map((section) => (
            <section key={section.key} aria-labelledby={`tag-section-${section.key}`} className="tag-section">
              <h3 id={`tag-section-${section.key}`}>
                {section.label}
                {section.exclusive ? <span className="badge badge-sauge">{t("tagGroupTierBadge")}</span> : null}
              </h3>
              <ul className="tag-lines">
                {section.tags.map((tag) => (
                  <li key={tag.id} data-filter-item={`${tag.label} ${section.label}`} aria-current={openedTag?.id === tag.id ? "true" : undefined}>
                    <span className="strong">{tag.label}</span>
                    <span className="meta">{familiesOf(tag.familyIds)}</span>
                    <span className="row-actions">
                      <Link href={`${BASE}?etiquette=${tag.id}`} scroll={false} aria-label={t("tagEdit", { tag: tag.label })}>
                        {t("tagEditShort")}
                      </Link>
                      <form action={removeVendorTagAction} className="inline-form">
                        <input type="hidden" name="tagId" value={tag.id} />
                        <button type="submit">{t("tagRemove", { tag: tag.label })}</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="tag-groups-title">
        <h2 id="tag-groups-title">{t("tagGroupsTitle")}</h2>
        <p className="muted">{t("tagGroupsIntro")}</p>
        {groups.length > 0 ? (
          <ul className="tag-lines">
            {groups.map((group) => (
              <li key={group.id}>
                <span className="strong">
                  {group.label} {group.exclusive ? <span className="badge badge-sauge">{t("tagGroupTierBadge")}</span> : null}
                </span>
                <span className="meta">{t("tagGroupCount", { count: tags.filter((tag) => tag.groupId === group.id).length })}</span>
                <span className="row-actions">
                  <details>
                    <summary>{t("tagGroupEdit", { group: group.label })}</summary>
                    <TagGroupForm group={group} />
                  </details>
                  <form action={removeVendorTagGroupAction} className="inline-form">
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" title={t("tagGroupRemoveHint")}>
                      {t("tagGroupRemove", { group: group.label })}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <h3>{t("tagGroupNewTitle")}</h3>
        <TagGroupForm />
      </section>

      {openedTag ? (
        <SidePanel title={openedTag.label} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <TagForm key={openedTag.id} tag={openedTag} groups={groups} families={families} />
        </SidePanel>
      ) : null}
    </main>
  );
}
