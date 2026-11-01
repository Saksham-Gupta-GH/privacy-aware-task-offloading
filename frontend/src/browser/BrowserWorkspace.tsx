import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { readDocumentLocally } from "./files";
import { classifyInBrowser } from "./privacy";
import { listBrowserDocuments, removeBrowserDocument, saveBrowserDocument } from "./storage";
import { summarizeExtractively } from "./summarize";
import { BrowserDocument } from "./types";

const badgeClass = (value: string) => `badge badge-${value}`;
const DEMO_DOCUMENTS = [
  {
    name: "public_cloud_event.txt",
    content: "The university cloud computing festival begins on Monday. The event includes an Azure deployment workshop and an edge-computing demonstration. Registration closes on Friday. Students from every department may attend. The organizing committee will publish the complete schedule online.",
  },
  {
    name: "personal_resume.txt",
    content: "Personal résumé for Aarya Mehta. Email: aarya@example.test. Aarya studies distributed systems and has experience with Python, React, and cloud computing. The candidate is available for an internship from June.",
  },
  {
    name: "restricted_payment.txt",
    content: "Fictional payment test record. Credit card number 4111 1111 1111 1111, expiry 12/30, CVV 123. This synthetic document exists only to test local-only privacy enforcement.",
  },
];

export function BrowserWorkspace() {
  const [documents, setDocuments] = useState<BrowserDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? documents[0],
    [documents, selectedId],
  );

  const refresh = async () => {
    const values = await listBrowserDocuments();
    setDocuments(values);
    if (!selectedId && values.length) setSelectedId(values[0].id);
  };

  useEffect(() => { refresh().catch((reason) => setError(String(reason))); }, []);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    try {
      const extracted = await readDocumentLocally(file);
      const document: BrowserDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        content: extracted.content,
        mediaType: extracted.mediaType,
        classification: classifyInBrowser(extracted.content),
        createdAt: Date.now(),
      };
      await saveBrowserDocument(document);
      await refresh();
      setSelectedId(document.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const summarize = async () => {
    if (!selected) return;
    const updated = { ...selected, summary: summarizeExtractively(selected.content, 3) };
    await saveBrowserDocument(updated);
    await refresh();
    setSelectedId(updated.id);
  };

  const loadDemoSet = async () => {
    const createdAt = Date.now();
    for (const [index, sample] of DEMO_DOCUMENTS.entries()) {
      await saveBrowserDocument({
        id: `demo-${index}`,
        name: sample.name,
        content: sample.content,
        mediaType: "text/plain",
        classification: classifyInBrowser(sample.content),
        createdAt: createdAt + index,
      });
    }
    await refresh();
    setSelectedId("demo-0");
  };

  const remove = async () => {
    if (!selected) return;
    await removeBrowserDocument(selected.id);
    setSelectedId("");
    await refresh();
  };

  return <>
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="browser-privacy-banner">
      <div><span>◎</span><div><b>Browser-private workspace</b><p>Files are read, classified and stored on this device. Uploads are not sent to the application server.</p></div></div>
      <div className="browser-banner-actions"><button className="demo-button" onClick={loadDemoSet}>Load fictional demo</button><label className="upload-button">{busy ? "Reading locally…" : "+ Add TXT or PDF"}<input disabled={busy} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={upload} /></label></div>
    </section>
    <div className="workspace-grid browser-workspace">
      <section className="panel file-panel">
        <div className="panel-title"><div><span className="eyebrow">INDEXEDDB ON THIS DEVICE</span><h2>Private documents</h2></div><span className="count">{documents.length} files</span></div>
        <div className="file-head"><span>Name</span><span>Privacy</span><span>Type</span></div>
        <div className="file-list">{documents.map((document) => <button key={document.id} className={selected?.id === document.id ? "selected" : ""} onClick={() => setSelectedId(document.id)}><span className="file-name"><i>{document.mediaType === "application/pdf" ? "PDF" : "TXT"}</i><b>{document.name}</b></span><span><em className={badgeClass(document.classification.sensitivity)}>{document.classification.displayName}</em></span><span className="file-status">{document.mediaType === "application/pdf" ? "Text PDF" : "Text"}</span></button>)}</div>
        {!documents.length && <div className="empty">Upload a text file or text-based PDF. Nothing leaves this browser.</div>}
      </section>
      <section className="panel inspector browser-inspector">
        {selected ? <>
          <div className="panel-title"><div><span className="eyebrow">LOCAL PRIVACY INSPECTION</span><h2>{selected.name}</h2></div><em className={badgeClass(selected.classification.sensitivity)}>{selected.classification.displayName}</em></div>
          <div className="classification-box"><span>Why this label?</span><p>{selected.classification.reasons.join(" ")}</p><small>Allowed: {selected.classification.allowedDestinations.join(" · ")}</small></div>
          <div className="document-preview"><span>Extracted locally</span><p>{selected.content.slice(0, 900)}{selected.content.length > 900 ? "…" : ""}</p></div>
          <div className="browser-actions"><button className="primary" onClick={summarize}>Summarize in browser <span>→</span></button><button className="danger-quiet" onClick={remove}>Remove from this device</button></div>
        </> : <div className="empty">Choose a local document to inspect it.</div>}
      </section>
    </div>
    {selected?.summary && <section className="panel summary-panel"><div className="panel-title"><div><span className="eyebrow">EXTRACTIVE SUMMARY · LOCAL EXECUTION</span><h2>Summary</h2></div><span className="local-only-chip">No network used</span></div><p>{selected.summary}</p></section>}
  </>;
}
