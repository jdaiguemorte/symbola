// RGPD-03 — preuve horodatée d'une demande d'oubli (@react-pdf/renderer,
// ADR 0019) : mise en page seulement, le contenu vient de proof-model.ts.
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProofModel } from "./proof-model";

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  organization: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  line: { marginBottom: 2 },
  section: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 3 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 3 },
  head: { fontFamily: "Helvetica-Bold" },
  module: { width: "30%", paddingRight: 6 },
  kind: { width: "35%", paddingRight: 6 },
  fate: { width: "25%", paddingRight: 6 },
  count: { width: "10%", textAlign: "right" },
  response: { lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 9, color: "#333333", textAlign: "right" },
});

export function ProofPdfDocument({ model }: { model: ProofModel }) {
  return (
    <Document title={model.title} author={model.organizationName} language={model.language}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.organization}>{model.organizationName}</Text>
        <Text style={styles.title}>{model.title}</Text>
        {model.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        <Text style={styles.section}>{model.acksTitle}</Text>
        {model.acks.map((ack) => (
          <Text key={ack} style={styles.line}>
            {ack}
          </Text>
        ))}
        <Text style={styles.section}>{model.itemsTitle}</Text>
        <View style={styles.headRow}>
          <Text style={[styles.head, styles.module]}>{model.columns.module}</Text>
          <Text style={[styles.head, styles.kind]}>{model.columns.kind}</Text>
          <Text style={[styles.head, styles.fate]}>{model.columns.fate}</Text>
          <Text style={[styles.head, styles.count]}>{model.columns.count}</Text>
        </View>
        {model.rows.map((row, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.module}>{row.module}</Text>
            <Text style={styles.kind}>{row.kind}</Text>
            <Text style={styles.fate}>{row.fate}</Text>
            <Text style={styles.count}>{row.count}</Text>
          </View>
        ))}
        <Text style={styles.section}>{model.keptTitle}</Text>
        {model.kept.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        <View break>
          <Text style={styles.section}>{model.responseTitle}</Text>
          <Text style={[styles.line, styles.head]}>{model.response.subject}</Text>
          <Text style={styles.response}>{model.response.body}</Text>
        </View>
        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)} />
      </Page>
    </Document>
  );
}
