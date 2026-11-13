// Lot 31b (FAC-04, DOC-03 ; D9) — mise en page A4 du contrat (@react-pdf/renderer, ADR 0019),
// seul ou à la suite du devis dans un même PDF (un envoi, une signature, un dossier de preuve),
// et du dossier de preuve lisible. Le contenu vient de contract-pdf-model.ts.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { DOCUMENT_INK } from "@/lib/documents/appearance";
import type { ContractPdfModel, EvidencePdfModel } from "./contract-pdf-model";
import type { QuotePdfModel } from "./quote-pdf-model";
import { FONTS, pageLabel, QuotePdfPage } from "./quote-pdf";

const MUTED = "#6b625b";

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingHorizontal: 38, paddingBottom: 60, color: DOCUMENT_INK, lineHeight: 1.45 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, paddingBottom: 12, marginBottom: 14 },
  logo: { height: 54, maxWidth: 170, objectFit: "contain" },
  headerName: { fontSize: 14 },
  titleBlock: { alignItems: "flex-end", maxWidth: "55%" },
  kind: { fontSize: 20, lineHeight: 1.1, letterSpacing: 1.2, textTransform: "uppercase" },
  number: { fontSize: 11, lineHeight: 1.2, marginTop: 4 },
  subtitle: { color: MUTED, textAlign: "right" },
  heading: { fontSize: 13, marginBottom: 10 },
  article: { marginBottom: 9 },
  articleTitle: { marginBottom: 2 },
  regime: { marginTop: 8, borderWidth: 1, borderColor: "#e6ded3", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  template: { marginTop: 8, color: MUTED, fontSize: 8 },
  signatureTitle: { marginTop: 22 },
  signature: { marginTop: 4, flexDirection: "row", flexWrap: "wrap" },
  signatureSlot: { width: "48%", marginRight: "2%", marginTop: 8, height: 80, borderWidth: 0.5, borderColor: "#999999", borderRadius: 4, padding: 6 },
  signatureTag: { fontSize: 8, color: "#ffffff" },
  pageNumber: { position: "absolute", top: 800, left: 38, right: 38, textAlign: "right", fontSize: 7.5, color: MUTED },
  watermark: { position: "absolute", top: 380, left: 60, fontSize: 64, color: "#bbbbbb", opacity: 0.4, transform: "rotate(-35deg)" },
  section: { marginBottom: 12 },
  line: { marginBottom: 2 },
});

export function ContractPdfPage({ model }: { model: ContractPdfModel }) {
  const { accent } = model.appearance;
  const font = FONTS[model.appearance.font];
  const bold = { fontFamily: font.bold };
  return (
    <Page size="A4" style={[styles.page, { fontFamily: font.regular, fontSize: font.size }]} wrap>
      {model.watermark ? (
        <Text style={[styles.watermark, bold]} fixed>
          {model.watermark}
        </Text>
      ) : null}
      <View style={[styles.header, { borderBottomColor: accent }]}>
        <View>
          {model.logo ? <Image style={styles.logo} src={{ data: model.logo.data, format: model.logo.format }} /> : <Text style={[styles.headerName, bold]}>{model.sellerName}</Text>}
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.kind, bold, { color: accent }]}>{model.kind}</Text>
          <Text style={[styles.number, bold]}>{model.number}</Text>
          <Text style={styles.subtitle}>{model.subtitle}</Text>
        </View>
      </View>
      <Text style={[styles.heading, bold, { color: accent }]}>{model.heading}</Text>
      {model.articles.map((article) => (
        <View key={article.heading} style={styles.article} wrap>
          <Text style={[styles.articleTitle, bold]}>{article.heading}</Text>
          <Text>{article.body}</Text>
        </View>
      ))}
      <View style={styles.regime} wrap={false}>
        <Text style={[bold, { color: accent }]}>{model.regime.title}</Text>
        {model.regime.lines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </View>
      <Text style={styles.template}>{model.template}</Text>
      {model.signature ? (
        <View wrap={false}>
          <Text style={[styles.signatureTitle, bold, { color: accent }]}>{model.signature.title}</Text>
          <View style={styles.signature}>
            {model.signature.slots.map((slot) => (
              <View key={slot.role} style={styles.signatureSlot}>
                <Text>{slot.role}</Text>
                {/* Balise lue par le fournisseur de signature (zone de signature). */}
                <Text style={styles.signatureTag}>{slot.tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageLabel(model.page, pageNumber, totalPages)} fixed />
    </Page>
  );
}

export function ContractPdfDocument({ model }: { model: ContractPdfModel }) {
  return (
    <Document title={model.title} author={model.sellerName} language={model.language}>
      <ContractPdfPage model={model} />
    </Document>
  );
}

// DOC-03 (D9) : un seul PDF, le devis puis son contrat ; la zone de signature est en fin de contrat.
export function QuoteAndContractPdfDocument({ quote, contract }: { quote: QuotePdfModel; contract: ContractPdfModel }) {
  return (
    <Document title={contract.title} author={contract.sellerName} language={contract.language}>
      <QuotePdfPage model={quote} />
      <ContractPdfPage model={contract} />
    </Document>
  );
}

export function EvidencePdfDocument({ model }: { model: EvidencePdfModel }) {
  const font = FONTS.modern;
  const bold = { fontFamily: font.bold };
  return (
    <Document title={model.title} language={model.language}>
      <Page size="A4" style={[styles.page, { fontFamily: font.regular, fontSize: font.size }]} wrap>
        <Text style={[styles.heading, bold]}>{model.title}</Text>
        <Text style={styles.section}>{model.intro}</Text>
        {model.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[bold, styles.line]}>{section.title}</Text>
            {section.lines.map((line, index) => (
              <Text key={`${section.title}-${index}`} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
