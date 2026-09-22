import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Builds a minimal, valid single-page PDF with real extractable text, via pdf-lib
 * so the byte structure is guaranteed spec-compliant — a hand-rolled PDF is easy to
 * get subtly wrong in ways that crash strict parsers (pypdf on the Odiobuk backend
 * included) instead of failing the graceful "no extractable text" path.
 */
export async function buildMinimalPdf(text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 720, size: 14, font, maxWidth: 500, lineHeight: 18 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
