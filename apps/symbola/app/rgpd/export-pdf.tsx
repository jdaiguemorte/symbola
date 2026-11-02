// RGPD-02 — PDF lisible de l'export des données d'une personne
// (@react-pdf/renderer, ADR 0019). Le contenu vient de buildExportPdfModel
// (lib/privacy/export.ts) ; ce fichier ne fait que la mise en page, lisible à
// l'impression (texte noir, 10 pt minimum).
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExportPdfModel } from "@/lib/privacy/export";

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  organization: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 10, color: "#333333", marginBottom: 2 },
  intro: { marginTop: 8, marginBottom: 14, lineHeight: 1.4 },
  section: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 3 },
  record: { marginBottom: 8 },
  heading: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  field: { flexDirection: "row", paddingVertical: 1 },
  fieldLabel: { width: "35%", paddingRight: 6, color: "#333333" },
  fieldValue: { width: "65%" },
  empty: { color: "#333333" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 9, color: "#333333", textAlign: "right" },
});

export function ExportPdfDocument({ model }: { model: ExportPdfModel }) {
  return (
    <Document title={model.title} author={model.organizationName} language={model.language}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.organization}>{model.organizationName}</Text>
        <Text style={styles.title}>{model.title}</Text>
        {model.person ? <Text style={styles.meta}>{model.person}</Text> : null}
        <Text style={styles.meta}>{model.generatedAt}</Text>
        <Text style={styles.intro}>{model.intro}</Text>
        {model.sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.section} minPresenceAhead={40}>
              {section.title}
            </Text>
            {section.records.map((record, index) => (
              <View key={index} style={styles.record} wrap={false}>
                <Text style={styles.heading}>{record.heading}</Text>
                {record.fields.length === 0 ? <Text style={styles.empty}>{model.noFields}</Text> : null}
                {record.fields.map((field, fieldIndex) => (
                  <View key={fieldIndex} style={styles.field}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldValue}>{field.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)} />
      </Page>
    </Document>
  );
}
