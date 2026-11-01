import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { readDocumentLocally } from "./files";
import { createSearchIndex, embedTexts, summarizeWithMiniLM } from "./ml";
import { classifyInBrowser } from "./privacy";
import { BrowserPlacement, BrowserWorker, decideBrowserPlacement } from "./scheduler";
import { dot } from "./semantic";
import { listBrowserDocuments, removeBrowserDocument, saveBrowserDocument } from "./storage";
import { summarizeExtractively } from "./summarize";
import { BrowserDocument, BrowserSearchResult } from "./types";

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
  const [readingFile, setReadingFile] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = readingFile || processing;
  const [latencyWeight, setLatencyWeight] = useState(65);
  const [scenario, setScenario] = useState("live");
  const [decision, setDecision] = useState<BrowserPlacement | null>(null);
  const [modelStatus, setModelStatus] = useState("First use downloads MiniLM (~27MB ONNX, cached locally); subsequent runs are instant");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BrowserSearchResult[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);
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
    setReadingFile(true); setError("");
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
      setReadingFile(false);
      event.target.value = "";
    }
  };

  const summarize = async () => {
    if (!selected) return;
    setProcessing(true); setError("");
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
        let operation = "minilm_mmr_summary";
        try {
          summary = await summarizeWithMiniLM(selected.content, 3, setModelStatus);
          setModelStatus("MiniLM ready · model cached on this device");
        } catch {
          summary = summarizeExtractively(selected.content, 3);
          operation = "frequency_fallback_summary";
          setModelStatus("MiniLM unavailable · used offline fallback");
        }
        receipt = {
          receipt_id: crypto.randomUUID(),
          worker_id: "browser-local-client",
          tier: "local",
          operation,
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
      setProcessing(false);
    }
  };

  const indexSelected = async () => {
    if (!selected) return;
    setProcessing(true); setError("");
    try {
      const started = performance.now();
      const searchPassages = await createSearchIndex(selected.content, setModelStatus);
      const updated: BrowserDocument = {
        ...selected,
        searchPassages,
        embeddingModel: "all-MiniLM-L6-v2",
        receipt: selected.receipt,
      };
      await saveBrowserDocument(updated);
      await refresh();
      setSelectedId(updated.id);
      setModelStatus(`Indexed locally with MiniLM · ${searchPassages.length} passage(s) · ${(performance.now() - started).toFixed(0)} ms`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local MiniLM indexing failed");
      setModelStatus("MiniLM could not be loaded on this device");
    } finally {
      setProcessing(false);
    }
  };

  const searchLocally = async () => {
    if (!query.trim()) return;
    const indexed = documents.filter((document) => document.searchPassages?.length);
    if (!indexed.length) {
      setError("Prepare at least one document for smart search first.");
      return;
    }
    setProcessing(true); setError("");
    try {
      const [queryVector] = await embedTexts([query.trim()], setModelStatus);
      const results = indexed.map((document): BrowserSearchResult => {
        const matches = document.searchPassages!.map((passage) => ({
          passage: passage.text,
          score: dot(queryVector, passage.embedding),
        })).sort((left, right) => right.score - left.score);
        return {
          documentId: document.id,
          name: document.name,
          sensitivity: document.classification.sensitivity,
          score: matches[0].score,
          matchingPassage: matches[0].passage,
        };
      }).sort((left, right) => right.score - left.score);
      setSearchResults(results.slice(0, 6));
      setModelStatus("Query and similarity search completed locally");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local semantic search failed");
    } finally {
      setProcessing(false);
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
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    await removeBrowserDocument(selected.id);
    setSelectedId("");
    setDeleteArmed(false);
    setDecision(null);
    await refresh();
  };

  return <>
    {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="browser-privacy-banner">
      <div><span>◎</span><div><b>Browser-private workspace</b><p>Files are read, classified and stored on this device. Uploads are not sent to the application server.</p></div></div>
      <div className="browser-banner-actions"><button className="demo-button" onClick={loadDemoSet}>Load fictional demo</button><label className="upload-button">{readingFile ? "Reading locally…" : "+ Add TXT or PDF"}<input disabled={busy} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={upload} /></label></div>
    </section>
    <section className="panel browser-search-panel">
      <div className="browser-search-row"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchLocally()} placeholder="Smart search by meaning across locally indexed documents…" /><button disabled={busy} onClick={searchLocally}>Search locally</button></div>
      <small>{modelStatus} · Documents and queries never leave this browser.</small>
      {searchResults.length > 0 && <div className="browser-search-results">{searchResults.map((result) => <button key={result.documentId} onClick={() => { setSelectedId(result.documentId); setSearchResults([]); setDecision(null); }}><span><b>{result.name}</b><em className={badgeClass(result.sensitivity)}>{result.sensitivity}</em></span><p>{result.matchingPassage.slice(0, 180)}{result.matchingPassage.length > 180 ? "…" : ""}</p><strong>{Math.max(0, Math.round(result.score * 100))}% semantic match</strong></button>)}</div>}
    </section>
    <div className="workspace-grid browser-workspace">
      <section className="panel file-panel">
        <div className="panel-title"><div><span className="eyebrow">INDEXEDDB ON THIS DEVICE</span><h2>Private documents</h2></div><span className="count">{documents.length} files</span></div>
        <div className="file-head"><span>Name</span><span>Privacy</span><span>Type</span></div>
        <div className="file-list">{documents.map((document) => <button key={document.id} className={selected?.id === document.id ? "selected" : ""} onClick={() => { setSelectedId(document.id); setDecision(null); setDeleteArmed(false); }}><span className="file-name"><i>{document.mediaType === "application/pdf" ? "PDF" : "TXT"}</i><b>{document.name}</b></span><span><em className={badgeClass(document.classification.sensitivity)}>{document.classification.displayName}</em></span><span className="file-status">{document.searchPassages?.length ? "Smart-search ready" : document.mediaType === "application/pdf" ? "Text PDF" : "Text"}</span></button>)}</div>
        {!documents.length && <div className="empty">Upload a text file or text-based PDF. Nothing leaves this browser.</div>}
      </section>
      <section className="panel inspector browser-inspector">
        {selected ? <>
          <div className="panel-title"><div><span className="eyebrow">LOCAL PRIVACY INSPECTION</span><h2>{selected.name}</h2></div><em className={badgeClass(selected.classification.sensitivity)}>{selected.classification.displayName}</em></div>
          <div className="classification-box"><span>Why this label?</span><p>{selected.classification.reasons.join(" ")}</p><small>Allowed: {selected.classification.allowedDestinations.join(" · ")}</small></div>
          <div className="document-preview"><span>Extracted locally</span><p>{selected.content.slice(0, 900)}{selected.content.length > 900 ? "…" : ""}</p></div>
          <div className="browser-control-grid"><label><span>Optimize for</span><b>{latencyWeight}% latency · {100 - latencyWeight}% energy</b><input type="range" min="0" max="100" value={latencyWeight} onChange={(event) => setLatencyWeight(Number(event.target.value))} /></label><label><span>Resource scenario</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="live">Live worker state</option><option value="client_busy">Simulated: client busy</option><option value="edge_busy">Simulated: edge busy</option><option value="client_and_edge_busy">Simulated: client + edge busy</option></select></label></div>
          {scenario !== "live" && <div className="simulation-note">Simulated queue pressure affects placement; execution and receipts remain real.</div>}
          <div className="browser-actions"><button className="primary" disabled={busy} onClick={summarize}>{busy ? "Running local ML task…" : "Evaluate & summarize"}<span>→</span></button><button className="secondary-action" disabled={busy} onClick={indexSelected}>{selected.searchPassages?.length ? "Refresh smart-search index" : "Prepare for smart search"}<span>⌁</span></button><button className={deleteArmed ? "danger-confirm" : "danger-quiet"} onClick={remove}>{deleteArmed ? `Confirm removal of ${selected.mediaType === "application/pdf" ? "PDF" : "document"}` : `Remove ${selected.mediaType === "application/pdf" ? "PDF" : "document"} from this device`}</button></div>
        </> : <div className="empty">Choose a local document to inspect it.</div>}
      </section>
    </div>
    {decision && <section className="panel browser-decision"><div className="panel-title"><div><span className="eyebrow">BROWSER PLACEMENT DECISION</span><h2>{decision.selectedTier ? `${decision.selectedTier.toUpperCase()} selected` : "Task deferred"}</h2><p>{decision.explanation}</p></div></div><div className="tier-grid">{decision.candidates.map((candidate) => <article key={candidate.tier} className={candidate.selected ? "winner" : candidate.privacyAllowed ? "" : "blocked"}><div className="tier-title"><span>{candidate.tier === "local" ? "▣" : candidate.tier === "edge" ? "◇" : "☁"}</span><b>{candidate.tier}</b>{candidate.selected && <em>Selected</em>}</div><dl><div><dt>Privacy</dt><dd>{candidate.privacyAllowed ? "Allowed" : "Blocked"}</dd></div><div><dt>Availability</dt><dd>{candidate.available ? "Ready" : "Unavailable"}</dd></div><div><dt>Predicted latency</dt><dd>{formatMs(candidate.predictedLatencyMs)}</dd></div><div><dt>Estimated energy</dt><dd>{formatEnergy(candidate.estimatedDeviceEnergyJ)}</dd></div></dl><p>{candidate.reason}</p></article>)}</div></section>}
    {selected?.summary && <section className="panel summary-panel"><div className="panel-title"><div><span className="eyebrow">SEMANTIC EXTRACTIVE SUMMARY · {displayedSummaryTier.toUpperCase()} EXECUTION</span><h2>Summary</h2></div><span className="local-only-chip">{displayedSummaryTier === "local" ? "No network used" : `Verified ${displayedSummaryTier} receipt`}</span></div><p>{selected.summary}</p>{selected.receipt && <div className="receipt"><span>Execution receipt</span><code>{String(selected.receipt.receipt_id).slice(0, 8)} · {String(selected.receipt.worker_id)} · {String(selected.receipt.processing_ms)} ms</code></div>}</section>}
  </>;
}
