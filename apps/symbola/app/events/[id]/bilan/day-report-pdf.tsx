// Lot 51 (PAR-08, étape 7 ; ADR 0019, ADR 0091) — le bilan du lendemain en PDF A4, interne à
// l'organisation : séquences prévues et réelles, décalages, incidents, cases non cochées, remises.
// Textes déjà traduits par l'appelant ; rendu côté serveur, à la demande, rangé nulle part.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type DayReportPdfSection = { title: string; lines: string[]; empty: string };
export type DayReportPdfLabels = { title: string; heading: string; preparedAt: string; footer: string; page: (page: number, total: number) => string };

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 56, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  heading: { fontSize: 12, marginBottom: 2 },
  meta: { fontSize: 9, color: "#444444", marginBottom: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 2 },
  line: { marginTop: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: "#999999" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#444444", flexDirection: "row", justifyContent: "space-between" },
});

export function DayReportPdf({ labels, sections, language }: { labels: DayReportPdfLabels; sections: DayReportPdfSection[]; language: string }) {
  return (
    <Document title={labels.title} language={language}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.heading}>{labels.heading}</Text>
        <Text style={styles.meta}>{labels.preparedAt}</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lines.length === 0 ? <Text style={styles.line}>{section.empty}</Text> : section.lines.map((line, index) => <Text key={`${index}-${line}`} style={styles.line} wrap={false}>{line}</Text>)}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text>{labels.footer}</Text>
          <Text render={({ pageNumber, totalPages }) => labels.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
