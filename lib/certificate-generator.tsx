import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchBlobAsBuffer } from "@/lib/blob-fetch";

export interface CertificateField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
  maxWidth?: number;
}

export interface CertificateData {
  STUDENT_NAME?: string;
  PROGRAM_NAME?: string;
  CERTIFICATE_NUMBER?: string;
  COMPLETION_DATE?: string;
  PRINCIPAL_NAME?: string;
  PRINCIPAL_SIGNATURE?: string;
  INSTITUTION_NAME?: string;
  INSTITUTION_LOGO?: string;
  CUSTOM_TEXT?: string;
  [key: string]: string | undefined;
}

const PAGE_SIZES = {
  A4: { LANDSCAPE: { width: 841.89, height: 595.28 }, PORTRAIT: { width: 595.28, height: 841.89 } },
  LETTER: { LANDSCAPE: { width: 792, height: 612 }, PORTRAIT: { width: 612, height: 792 } },
} as const;

const styles = StyleSheet.create({
  page: { position: "relative" },
  background: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  signatureImage: { height: 50, width: "auto", objectFit: "contain" },
  logoImage: { height: 40, width: "auto", objectFit: "contain" },
});

/**
 * React-PDF component for certificates with IMAGE backgrounds.
 * For PDF backgrounds, use `generateCertificateFromPdfTemplate()` instead.
 */
export function CertificatePdf({
  backgroundUrl,
  orientation,
  pageSize,
  fields,
  data,
}: {
  backgroundUrl?: string | null;
  orientation: "LANDSCAPE" | "PORTRAIT";
  pageSize: "A4" | "LETTER";
  fields: CertificateField[];
  data: CertificateData;
}) {
  const dims = PAGE_SIZES[pageSize]?.[orientation] ?? PAGE_SIZES.A4.LANDSCAPE;

  return (
    <Document>
      <Page size={[dims.width, dims.height]} style={styles.page}>
        {backgroundUrl && <Image src={backgroundUrl} style={styles.background} />}

        {fields.map((field, i) => {
          const value = data[field.key] ?? "";
          if (!value && field.key !== "PRINCIPAL_SIGNATURE" && field.key !== "INSTITUTION_LOGO") return null;

          const fieldStyle = {
            position: "absolute" as const,
            left: (field.x / 100) * dims.width,
            top: (field.y / 100) * dims.height,
            maxWidth: field.maxWidth ? (field.maxWidth / 100) * dims.width : dims.width * 0.8,
          };

          if (field.key === "PRINCIPAL_SIGNATURE" && value) {
            return (
              <View key={i} style={fieldStyle}>
                <Image src={value} style={styles.signatureImage} />
              </View>
            );
          }

          if (field.key === "INSTITUTION_LOGO" && value) {
            return (
              <View key={i} style={fieldStyle}>
                <Image src={value} style={styles.logoImage} />
              </View>
            );
          }

          return (
            <Text
              key={i}
              style={{
                ...fieldStyle,
                fontSize: field.fontSize,
                fontWeight: field.fontWeight === "bold" ? "bold" : "normal",
                fontFamily: field.fontWeight === "bold" ? "Helvetica-Bold" : "Helvetica",
                color: field.color || "#000000",
                textAlign: field.align || "center",
              }}
            >
              {value}
            </Text>
          );
        })}
      </Page>
    </Document>
  );
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Generates a certificate PDF using a PDF file as the background template.
 * Uses pdf-lib to overlay text fields on top of the first page of the template PDF.
 */
export async function generateCertificateFromPdfTemplate(params: {
  pdfUrl: string;
  orientation: "LANDSCAPE" | "PORTRAIT";
  pageSize: "A4" | "LETTER";
  fields: CertificateField[];
  data: CertificateData;
}): Promise<Uint8Array> {
  const { pdfUrl, orientation, pageSize, fields, data } = params;

  // Fetch the template PDF (handles private Vercel Blob stores)
  const templateBuffer = await fetchBlobAsBuffer(pdfUrl);
  const templateDoc = await PDFDocument.load(templateBuffer);

  const newDoc = await PDFDocument.create();
  const dims = PAGE_SIZES[pageSize]?.[orientation] ?? PAGE_SIZES.A4.LANDSCAPE;

  // Copy the first page from the template
  const [templatePage] = await newDoc.copyPages(templateDoc, [0]);
  newDoc.addPage(templatePage);

  const page = newDoc.getPages()[0];
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const fontRegular = await newDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await newDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of fields) {
    const value = data[field.key] ?? "";
    if (!value) continue;

    // Skip image fields for pdf-lib (signature/logo can't be trivially embedded from URL in pdf-lib without fetching)
    if (field.key === "PRINCIPAL_SIGNATURE" || field.key === "INSTITUTION_LOGO") {
      if (value && (value.startsWith("http://") || value.startsWith("https://"))) {
        try {
          const imgBytes = await fetchBlobAsBuffer(value);
          let img;
          if (value.toLowerCase().includes(".png")) {
            img = await newDoc.embedPng(imgBytes);
          } else {
            img = await newDoc.embedJpg(imgBytes);
          }
          const scale = field.key === "PRINCIPAL_SIGNATURE" ? 50 : 40;
          const imgDims = img.scaleToFit(scale * 2, scale);
          const x = (field.x / 100) * pageWidth;
          const y = pageHeight - (field.y / 100) * pageHeight - imgDims.height;
          page.drawImage(img, { x, y, width: imgDims.width, height: imgDims.height });
        } catch {
          // If image fetch/embed fails, skip silently
        }
      }
      continue;
    }

    const font = field.fontWeight === "bold" ? fontBold : fontRegular;
    const fontSize = field.fontSize;
    const color = hexToRgb(field.color || "#000000");

    // pdf-lib coordinate system: (0,0) is bottom-left; fields use top-left percentages
    const x = (field.x / 100) * pageWidth;
    const y = pageHeight - (field.y / 100) * pageHeight - fontSize;

    page.drawText(value, { x, y, size: fontSize, font, color });
  }

  return newDoc.save();
}

export function isPdfUrl(url: string | null | undefined, fileName?: string | null): boolean {
  if (fileName && fileName.toLowerCase().endsWith(".pdf")) return true;
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf");
}

export const DEFAULT_FIELDS: CertificateField[] = [
  { key: "INSTITUTION_LOGO", label: "Institution Logo", x: 43, y: 5, fontSize: 12, fontWeight: "normal", color: "#000000", align: "center", maxWidth: 14 },
  { key: "INSTITUTION_NAME", label: "Institution Name", x: 20, y: 15, fontSize: 22, fontWeight: "bold", color: "#1e1b4b", align: "center", maxWidth: 60 },
  { key: "CUSTOM_TEXT", label: "Certificate Title", x: 15, y: 25, fontSize: 28, fontWeight: "bold", color: "#312e81", align: "center", maxWidth: 70 },
  { key: "STUDENT_NAME", label: "Student Name", x: 15, y: 40, fontSize: 24, fontWeight: "bold", color: "#111827", align: "center", maxWidth: 70 },
  { key: "PROGRAM_NAME", label: "Program Name", x: 15, y: 50, fontSize: 16, fontWeight: "normal", color: "#374151", align: "center", maxWidth: 70 },
  { key: "COMPLETION_DATE", label: "Date", x: 15, y: 60, fontSize: 14, fontWeight: "normal", color: "#6b7280", align: "center", maxWidth: 70 },
  { key: "CERTIFICATE_NUMBER", label: "Certificate Number", x: 5, y: 90, fontSize: 10, fontWeight: "normal", color: "#9ca3af", align: "left", maxWidth: 30 },
  { key: "PRINCIPAL_NAME", label: "Principal Name", x: 60, y: 78, fontSize: 14, fontWeight: "bold", color: "#111827", align: "center", maxWidth: 30 },
  { key: "PRINCIPAL_SIGNATURE", label: "Principal Signature", x: 62, y: 70, fontSize: 12, fontWeight: "normal", color: "#000000", align: "center", maxWidth: 25 },
];
