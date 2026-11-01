import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export async function extractPdfText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = "";
    let previousY: number | undefined;
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = item.transform[5];
      if (line && previousY !== undefined && Math.abs(y - previousY) > 4) {
        lines.push(line.trim());
        line = "";
      }
      line += `${line ? " " : ""}${item.str.trim()}`;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = "";
      }
      previousY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n").trim();
}
