// Lot 50 (INV-06 ; D6, D7 ; ADR 0019) — la synthèse pour le traiteur en PDF A4, lisible imprimée en
// noir et blanc : une page de totaux (couverts, repas par type, régimes et allergènes, repas des
// prestataires, personnes en attente de réponse), puis les tables dans l'ordre du plan, une table
// jamais coupée entre deux pages. Les textes viennent des traductions (langue de l'organisation) ;
// le rendu se fait côté serveur, à la demande, et n'est rangé nulle part (D8).
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CatererCount, CatererPerson, CatererSummary, CatererTable } from "@symbola/contracts";

export type CatererPdfLabels = {
  title: string;
  heading: string;
  generatedAt: string;
  version: string;
  noPlan: string | null;
  dietsPurged: string | null;
  totalsTitle: string;
  coversLabel: string;
  covers: (count: number) => string;
  mealsTitle: string;
  dietsTitle: string;
  noDiets: string;
  vendorMeals: string;
  pendingTitle: string;
  pendingNone: string;
  tablesTitle: string;
  unplaced: string;
  tableLine: (table: CatererTable) => string;
  personLine: (person: CatererPerson) => string;
  footer: string;
  page: (page: number, total: number) => string;
};

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 56, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  heading: { fontSize: 12, marginBottom: 2 },
  meta: { fontSize: 9, color: "#444444", marginBottom: 2 },
  note: { fontSize: 10, marginTop: 6, padding: 6, borderWidth: 1, borderColor: "#111111" },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 3 },
  label: { width: "75%", paddingRight: 6 },
  value: { width: "25%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  table: { marginTop: 10, borderWidth: 1, borderColor: "#111111", padding: 6 },
  tableName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  line: { marginTop: 1 },
  person: { marginTop: 1, paddingLeft: 8 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#444444", flexDirection: "row", justifyContent: "space-between" },
  footerText: { width: "80%" },
});

function Counts({ counts, empty }: { counts: CatererCount[]; empty?: string }) {
  if (counts.length === 0) return empty ? <Text style={styles.line}>{empty}</Text> : null;
  return (
    <View>
      {counts.map((count) => (
        <View key={count.id} style={styles.row}>
          <Text style={styles.label}>{count.label}</Text>
          <Text style={styles.value}>{String(count.count)}</Text>
        </View>
      ))}
    </View>
  );
}

const inline = (counts: CatererCount[]) => counts.map((count) => `${count.label} ${count.count}`).join(" · ");

export function CatererSummaryPdf({ summary, labels, language }: { summary: CatererSummary; labels: CatererPdfLabels; language: string }) {
  return (
    <Document title={`${labels.title} — ${labels.heading}`} language={language}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.heading}>{labels.heading}</Text>
        <Text style={styles.meta}>{labels.generatedAt}</Text>
        <Text style={styles.meta}>{labels.version}</Text>
        {labels.noPlan ? <Text style={styles.note}>{labels.noPlan}</Text> : null}
        {labels.dietsPurged ? <Text style={styles.note}>{labels.dietsPurged}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.totalsTitle}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.coversLabel}</Text>
            <Text style={styles.value}>{String(summary.totals.covers)}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.mealsTitle}</Text>
          <Counts counts={summary.totals.meals} />
          <View style={styles.row}>
            <Text style={styles.label}>{labels.vendorMeals}</Text>
            <Text style={styles.value}>{String(summary.vendorMeals.count)}</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.dietsTitle}</Text>
          <Counts counts={summary.totals.diets} empty={labels.noDiets} />
        </View>
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{labels.pendingTitle}</Text>
          {summary.pending.covers === 0 ? (
            <Text style={styles.line}>{labels.pendingNone}</Text>
          ) : (
            <>
              <Text style={styles.line}>{inline(summary.pending.meals)}</Text>
              {summary.pending.diets.length > 0 ? <Text style={styles.line}>{inline(summary.pending.diets)}</Text> : null}
              {(summary.pending.people ?? []).map((person, index) => (
                <Text key={index} style={styles.person}>
                  {labels.personLine(person)}
                </Text>
              ))}
            </>
          )}
        </View>

        {summary.tables.length > 0 ? (
          <View break>
            <Text style={styles.sectionTitle}>{labels.tablesTitle}</Text>
            {summary.tables.map((table, index) => (
              <View key={table.id ?? `unplaced-${index}`} style={styles.table} wrap={false}>
                <Text style={styles.tableName}>{table.id === null ? labels.unplaced : labels.tableLine(table)}</Text>
                <Text style={styles.line}>{`${labels.covers(table.covers)} : ${inline(table.meals)}`}</Text>
                {table.diets.length > 0 ? <Text style={styles.line}>{inline(table.diets)}</Text> : null}
                {(table.people ?? []).map((person, position) => (
                  <Text key={position} style={styles.person}>
                    {labels.personLine(person)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{labels.footer}</Text>
          <Text render={({ pageNumber, totalPages }) => labels.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
