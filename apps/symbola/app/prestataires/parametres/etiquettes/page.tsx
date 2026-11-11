// Lot 11 (L11-PRE-05) — étiquettes du carnet. Lot 20 (décision 5, ADR 0049) :
// rangées par groupe, rattachées à des familles, groupes « palier » à choix
// unique ; paliers repérés dans les étiquettes importées, à ranger d'un clic.
// Décision 3 : ajout en tête, liste filtrable, modification dans un panneau.
// Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050) : en tête, le rangement des étiquettes
// importées et l'ajout des étiquettes proposées (TagSetup).
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { countMissingStarterVendorTags, listVendorFamilies, listVendorTagGroups, listVendorTags, previewVendorTagArrangement } from "@/modules/vendors/service";
import { organizationTagCatalog } from "@/lib/vendors/tag-catalog";
import { isValidId } from "@/app/events/module-access";
import { removeVendorTagAction, removeVendorTagGroupAction } from "../../actions";
import { TagSetup } from "./tag-setup";
import { vendorSettingsAccess } from "../guard";
import { TagForm, TagGroupForm } from "../settings-forms";
import { ScreenHelp } from "@/app/screen-help";
import { ListFilter } from "@/app/ui/list-filter";
import { SidePanel } from "@/app/ui/side-panel";

const BASE = "/prestataires/parametres/etiquettes";

export default async function VendorTagsPage({ searchParams }: { searchParams: Promise<{ etiquette?: string; groupe?: string }> }) {
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
  const catalog = await organizationTagCatalog(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  const [tags, groups, families, arrangement, missing] = await Promise.all([
    listVendorTags(organizationId),
    listVendorTagGroups(organizationId),
    listVendorFamilies(organizationId),
    previewVendorTagArrangement(organizationId, catalog),
    countMissingStarterVendorTags(organizationId, catalog),
  ]);
  const query = await searchParams;
  const opened = query.etiquette;
  const openedTag = opened && isValidId(opened) ? tags.find((tag) => tag.id === opened) : undefined;
  // Lot 21 : un groupe se modifie aussi dans le panneau latéral.
  const openedGroup = query.groupe && isValidId(query.groupe) ? groups.find((group) => group.id === query.groupe) : undefined;
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

      <TagSetup canArrange={arrangement.changed} looseTags={arrangement.looseTags} missing={missing} />

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
                    {/* Lot 21 : actions en icônes, pour laisser la place au libellé. */}
                    <span className="row-actions">
                      <Link href={`${BASE}?etiquette=${tag.id}`} scroll={false} className="icon-button" aria-label={t("tagEdit", { tag: tag.label })} title={t("tagEdit", { tag: tag.label })}>
                        <Pencil aria-hidden="true" />
                      </Link>
                      <form action={removeVendorTagAction} className="inline-form">
                        <input type="hidden" name="tagId" value={tag.id} />
                        <button type="submit" className="icon-button" aria-label={t("tagRemove", { tag: tag.label })} title={t("tagRemove", { tag: tag.label })}>
                          <Trash2 aria-hidden="true" />
                        </button>
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
                  <Link href={`${BASE}?groupe=${group.id}`} scroll={false} className="icon-button" aria-label={t("tagGroupEdit", { group: group.label })} title={t("tagGroupEdit", { group: group.label })}>
                    <Pencil aria-hidden="true" />
                  </Link>
                  <form action={removeVendorTagGroupAction} className="inline-form">
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="icon-button" aria-label={t("tagGroupRemove", { group: group.label })} title={t("tagGroupRemoveHint")}>
                      <Trash2 aria-hidden="true" />
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

      {openedGroup ? (
        <SidePanel title={openedGroup.label} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <TagGroupForm key={openedGroup.id} group={openedGroup} />
        </SidePanel>
      ) : null}
      {openedTag ? (
        <SidePanel title={openedTag.label} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <TagForm key={openedTag.id} tag={openedTag} groups={groups} families={families} />
        </SidePanel>
      ) : null}
    </main>
  );
}
