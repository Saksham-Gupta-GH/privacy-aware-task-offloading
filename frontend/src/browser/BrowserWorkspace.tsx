import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { readDocumentLocally } from "./files";
import { classifyInBrowser } from "./privacy";
import { BrowserPlacement, BrowserWorker, decideBrowserPlacement } from "./scheduler";
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

const CONTROL_API = import.meta.env.VITE_CONTROL_API ?? "";
const formatMs = (value: number | null) => value == null ? "—" : value < 1000 ? `${value.toFixed(0)} ms` : `${(value / 1000).toFixed(2)} s`;
const formatEnergy = (value: number | null) => value == null ? "—" : `${value.toFixed(3)} J`;

export function BrowserWorkspace({ workers }: { workers: Record<string, BrowserWorker> }) {
  const [documents, setDocuments] = useState<BrowserDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [latencyWeight, setLatencyWeight] = useState(65);
  const [scenario, setScenario] = useState("live");
  const [decision, setDecision] = useState<BrowserPlacement | null>(null);
  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? documents[0],
    [documents, selectedId],
  );
  const displayedSummaryTier = selected?.summaryTier
    ?? (typeof selected?.receipt?.tier === "string" ? selected.receipt.tier : "local");

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
    setBusy(true); setError("");
    const placement = decideBrowserPlacement({
      classification: selected.classification,
      workers,
      content: selected.content,
      latencyWeight: latencyWeight / 100,
      scenario,
    });
    setDecision(placement);
    try {
      if (!placement.selectedTier) throw new Error("No safe processing destination is available.");
      const started = performance.now();
      let summary: string;
      let receipt: Record<string, unknown>;
      if (placement.selectedTier === "local") {
        summary = summarizeExtractively(selected.content, 3);
        receipt = {
          receipt_id: crypto.randomUUID(),
          worker_id: "browser-local-client",
          tier: "local",
          operation: "extractive_summary",
          processing_ms: Math.round((performance.now() - started) * 1000) / 1000,
        };
      } else {
        const response = await fetch(`${CONTROL_API}/api/browser/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_id: selected.id,
            document_name: selected.name,
            content: selected.content,
            selected_tier: placement.selectedTier,
            reported_sensitivity: selected.classification.sensitivity,
            sentence_count: 3,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "Remote summarization failed");
        summary = payload.summary;
        receipt = payload.receipt;
      }
      const updated: BrowserDocument = {
        ...selected,
        summary,
        summaryTier: placement.selectedTier,
        receipt,
      };
      await saveBrowserDocument(updated);
      await refresh();
      setSelectedId(updated.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
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
        <div className="file-list">{documents.map((document) => <button key={document.id} className={selected?.id === document.id ? "selected" : ""} onClick={() => { setSelectedId(document.id); setDecision(null); }}><span className="file-name"><i>{document.mediaType === "application/pdf" ? "PDF" : "TXT"}</i><b>{document.name}</b></span><span><em className={badgeClass(document.classification.sensitivity)}>{document.classification.displayName}</em></span><span className="file-status">{document.mediaType === "application/pdf" ? "Text PDF" : "Text"}</span></button>)}</div>
        {!documents.length && <div className="empty">Upload a text file or text-based PDF. Nothing leaves this browser.</div>}
      </section>
      <section className="panel inspector browser-inspector">
        {selected ? <>
          <div className="panel-title"><div><span className="eyebrow">LOCAL PRIVACY INSPECTION</span><h2>{selected.name}</h2></div><em className={badgeClass(selected.classification.sensitivity)}>{selected.classification.displayName}</em></div>
          <div className="classification-box"><span>Why this label?</span><p>{selected.classification.reasons.join(" ")}</p><small>Allowed: {selected.classification.allowedDestinations.join(" · ")}</small></div>
          <div className="document-preview"><span>Extracted locally</span><p>{selected.content.slice(0, 900)}{selected.content.length > 900 ? "…" : ""}</p></div>
          <div className="browser-control-grid"><label><span>Optimize for</span><b>{latencyWeight}% latency · {100 - latencyWeight}% energy</b><input type="range" min="0" max="100" value={latencyWeight} onChange={(event) => setLatencyWeight(Number(event.target.value))} /></label><label><span>Resource scenario</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="live">Live worker state</option><option value="client_busy">Simulated: client busy</option><option value="edge_busy">Simulated: edge busy</option><option value="client_and_edge_busy">Simulated: client + edge busy</option></select></label></div>
          {scenario !== "live" && <div className="simulation-note">Simulated queue pressure affects placement; execution and receipts remain real.</div>}
          <div className="browser-actions"><button className="primary" disabled={busy} onClick={summarize}>{busy ? "Evaluating safe placement…" : "Evaluate & summarize"}<span>→</span></button><button className="danger-quiet" onClick={remove}>Remove from this device</button></div>
        </> : <div className="empty">Choose a local document to inspect it.</div>}
      </section>
    </div>
    {decision && <section className="panel browser-decision"><div className="panel-title"><div><span className="eyebrow">BROWSER PLACEMENT DECISION</span><h2>{decision.selectedTier ? `${decision.selectedTier.toUpperCase()} selected` : "Task deferred"}</h2><p>{decision.explanation}</p></div></div><div className="tier-grid">{decision.candidates.map((candidate) => <article key={candidate.tier} className={candidate.selected ? "winner" : candidate.privacyAllowed ? "" : "blocked"}><div className="tier-title"><span>{candidate.tier === "local" ? "▣" : candidate.tier === "edge" ? "◇" : "☁"}</span><b>{candidate.tier}</b>{candidate.selected && <em>Selected</em>}</div><dl><div><dt>Privacy</dt><dd>{candidate.privacyAllowed ? "Allowed" : "Blocked"}</dd></div><div><dt>Availability</dt><dd>{candidate.available ? "Ready" : "Unavailable"}</dd></div><div><dt>Predicted latency</dt><dd>{formatMs(candidate.predictedLatencyMs)}</dd></div><div><dt>Estimated energy</dt><dd>{formatEnergy(candidate.estimatedDeviceEnergyJ)}</dd></div></dl><p>{candidate.reason}</p></article>)}</div></section>}
    {selected?.summary && <section className="panel summary-panel"><div className="panel-title"><div><span className="eyebrow">EXTRACTIVE SUMMARY · {displayedSummaryTier.toUpperCase()} EXECUTION</span><h2>Summary</h2></div><span className="local-only-chip">{displayedSummaryTier === "local" ? "No network used" : `Verified ${displayedSummaryTier} receipt`}</span></div><p>{selected.summary}</p>{selected.receipt && <div className="receipt"><span>Execution receipt</span><code>{String(selected.receipt.receipt_id).slice(0, 8)} · {String(selected.receipt.worker_id)} · {String(selected.receipt.processing_ms)} ms</code></div>}</section>}
  </>;
}
