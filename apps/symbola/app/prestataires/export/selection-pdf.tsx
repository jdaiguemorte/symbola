// Lot 11 (L11-PRE-11) — sélection du carnet en PDF A4, à proposer aux clients
// (@react-pdf/renderer, ADR 0019) : nom, type, ville, trajet estimé.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExportLabels, ExportRow } from "./selection-export";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#444444", marginBottom: 14 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 5 },
  head: { fontFamily: "Helvetica-Bold" },
  name: { width: "30%", paddingRight: 6 },
  type: { width: "20%", paddingRight: 6 },
  city: { width: "20%", paddingRight: 6 },
  travel: { width: "30%" },
});

export function SelectionPdf({ title, subtitle, rows, labels }: { title: string; subtitle: string; rows: ExportRow[]; labels: ExportLabels }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.headRow} fixed>
          <Text style={[styles.name, styles.head]}>{labels.name}</Text>
          <Text style={[styles.type, styles.head]}>{labels.type}</Text>
          <Text style={[styles.city, styles.head]}>{labels.city}</Text>
          <Text style={[styles.travel, styles.head]}>{labels.distance}</Text>
        </View>
        {rows.map((row, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.type}>{row.type}</Text>
            <Text style={styles.city}>{row.city}</Text>
            <Text style={styles.travel}>{row.travel}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
