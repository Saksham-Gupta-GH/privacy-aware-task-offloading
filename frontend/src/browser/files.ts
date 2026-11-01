const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function readDocumentLocally(file: File): Promise<{
  content: string;
  mediaType: "text/plain" | "application/pdf";
}> {
  if (file.size > MAX_FILE_BYTES) throw new Error("File is larger than the 8 MB prototype limit.");
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const { extractPdfText } = await import("./pdf");
    const content = await extractPdfText(file);
    if (!content.trim()) {
      throw new Error("No selectable text was found. Scanned PDFs require OCR, which is not enabled.");
    }
    return { content, mediaType: "application/pdf" };
  }
  if (file.type === "text/plain" || lowerName.endsWith(".txt")) {
    return { content: await file.text(), mediaType: "text/plain" };
  }
  throw new Error("Only .txt and text-based .pdf files are supported.");
}
