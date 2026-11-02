import { useState } from "react";

export function summarySections(summary: string) {
  const sections: { title: string; items: string[] }[] = [];
  for (const raw of summary.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) sections.push({ title: line.slice(3), items: [] });
    else {
      if (!sections.length) sections.push({ title: "", items: [] });
      sections[sections.length - 1].items.push(line.replace(/^[-•]\s+/, ""));
    }
  }
  return sections.filter((section) => section.items.length);
}

export function SummaryPanel({ summary, filename, receipt, tier }: {
  summary: string; filename: string; receipt?: Record<string, unknown>; tier?: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const sections = summarySections(summary);
  const words = summary.replace(/^(?:## |[-•] )/gm, "").trim().split(/\s+/).filter(Boolean).length;
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopyStatus("Copied"); }
    catch { setCopyStatus("Copy unavailable. Select the text to copy it."); }
  };
  return <section className="panel summary-panel" aria-label="Document summary">
    <div className="panel-heading summary-heading">
      <div><span className="summary-eyebrow">DOCUMENT SUMMARY</span><h2>{filename}</h2>
        <p>{words} words · {sections.length} {sections.length === 1 ? "section" : "sections"}</p></div>
      <button className="button button-quiet" onClick={copy}>Copy summary</button>
    </div>
    <span className="summary-copy-status" role="status">{copyStatus}</span>
    <div className="summary-sections">{sections.map((section, index) =>
      <section className="summary-section" key={index}>
        {section.title && <h3>{section.title}</h3>}
        <ul>{section.items.map((item, itemIndex) => {
          const separator = item.indexOf(": ");
          return <li key={itemIndex}><span className="summary-bullet" aria-hidden="true">•</span><div>
            {separator > 0 && separator < 180
              ? <><strong className="summary-context">{item.slice(0, separator)}</strong><span>{item.slice(separator + 2)}</span></>
              : <span>{item}</span>}
          </div></li>;
        })}</ul>
      </section>)}</div>
    {receipt && <details className="summary-processing"><summary>Processing details · {tier ?? String(receipt.tier ?? "local")}</summary>
      <div className="receipt-line"><span>Processed on {String(receipt.worker_id ?? tier ?? "local")}</span>
        <code>{String(receipt.receipt_id ?? "").slice(0, 8)} · {String(receipt.processing_ms ?? "—")} ms</code></div>
    </details>}
  </section>;
}
