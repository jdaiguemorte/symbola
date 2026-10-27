// DEV-01 — rendu A4 du devis (@react-pdf/renderer, ADR 0019). Le contenu
// vient de buildQuotePdfModel ; ce fichier ne fait que la mise en page.
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { QuotePdfModel } from "./quote-pdf-model";

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  logo: { maxWidth: 140, maxHeight: 60, objectFit: "contain", marginBottom: 4 },
  sellerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  status: { fontSize: 11, color: "#444444", marginBottom: 4 },
  meta: { marginBottom: 2 },
  table: { marginTop: 14 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 5 },
  headCell: { fontFamily: "Helvetica-Bold" },
  description: { fontSize: 9, color: "#444444" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  strong: { fontFamily: "Helvetica-Bold" },
  mention: { marginTop: 16 },
  watermark: {
    position: "absolute",
    top: 380,
    left: 60,
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#bbbbbb",
    opacity: 0.4,
    transform: "rotate(-35deg)",
  },
});

// Largeurs : la désignation prend la place laissée par les colonnes chiffrées.
function columnWidths(count: number): string[] {
  const numeric = count === 6 ? ["12%", "14%", "10%", "10%", "14%"] : ["14%", "16%", "12%", "16%"];
  const used = numeric.reduce((sum, width) => sum + Number.parseInt(width, 10), 0);
  return [`${100 - used}%`, ...numeric];
}

export function QuotePdfDocument({ model }: { model: QuotePdfModel }) {
  const widths = columnWidths(model.columns.length);
  return (
    <Document title={model.title} author={model.seller.name} language={model.language}>
      <Page size="A4" style={styles.page} wrap>
        {model.watermark ? (
          <Text style={styles.watermark} fixed>
            {model.watermark}
          </Text>
        ) : null}
        <View style={styles.header}>
          <View>
            {model.logo ? <Image style={styles.logo} src={{ data: model.logo.data, format: model.logo.format }} /> : null}
            <Text style={styles.sellerName}>{model.seller.name}</Text>
            {model.seller.lines.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>
          <View>
            <Text>{model.client}</Text>
          </View>
        </View>
        <Text style={styles.title}>{model.title}</Text>
        {model.status ? <Text style={styles.status}>{model.status}</Text> : null}
        {model.dates.map((date) => (
          <Text key={date} style={styles.meta}>
            {date}
          </Text>
        ))}

        <View style={styles.table}>
          <View style={styles.headRow} fixed>
            {model.columns.map((column, index) => (
              <Text key={column} style={[styles.headCell, { width: widths[index]! }]}>
                {column}
              </Text>
            ))}
          </View>
          {model.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row} wrap={false}>
              {row.cells.map((cell, index) => (
                <View key={index} style={{ width: widths[index]!, paddingRight: 4 }}>
                  <Text>{cell}</Text>
                  {index === 0 && row.description ? <Text style={styles.description}>{row.description}</Text> : null}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          {model.totals.map((total) => (
            <View key={total.label} style={styles.totalRow}>
              <Text style={total.strong ? styles.strong : {}}>{total.label}</Text>
              <Text style={total.strong ? styles.strong : {}}>{total.value}</Text>
            </View>
          ))}
        </View>
        {model.legalMention ? <Text style={styles.mention}>{model.legalMention}</Text> : null}
      </Page>
    </Document>
  );
}
