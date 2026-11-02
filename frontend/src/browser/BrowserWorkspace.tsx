import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { readDocumentLocally } from "./files";
import { createSearchIndex, embedTexts, summarizeWithMiniLM } from "./ml";
import { classifyInBrowser } from "./privacy";
import { BrowserPlacement, BrowserWorker, decideBrowserPlacement } from "./scheduler";
import { calibrateScore, dot } from "./semantic";
import { claimLegacyBrowserDocuments, listBrowserDocuments, removeBrowserDocument, saveBrowserDocument } from "./storage";
import { summarizeStructured } from "./structured-summary";
import { SummaryPanel } from "./SummaryPanel";
import { BrowserDocument, BrowserSearchResult } from "./types";
import {
  IconSearch,
  IconShield,
  IconCheck,
  IconCloud,
  IconLaptop,
  IconServer,
} from "../components/Icons";

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

function highlightQuery(text: string, queryText: string) {
  if (!queryText.trim()) return text;
  const terms = queryText.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    terms.includes(part.toLowerCase()) ? <mark key={i} className="search-match-highlight">{part}</mark> : part
  );
}

export function BrowserWorkspace({ workers, page, token, userId, onOpenFile }: { workers: Record<string, BrowserWorker>; page: "files" | "search"; token: string; userId: string; onOpenFile: () => void }) {
  const [documents, setDocuments] = useState<BrowserDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = readingFile || processing;
  const [latencyWeight, setLatencyWeight] = useState(65);
  const [scenario, setScenario] = useState("live");
  const [summaryWordBudget, setSummaryWordBudget] = useState(180);
  const [decision, setDecision] = useState<BrowserPlacement | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BrowserSearchResult[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? documents[0],
    [documents, selectedId],
  );
  const refresh = async () => {
    await claimLegacyBrowserDocuments(userId);
    const values = await listBrowserDocuments(userId);
    setDocuments(values);
    if (!selectedId && values.length) setSelectedId(values[0].id);
  };

  useEffect(() => {
    setSelectedId("");
    setDocuments([]);
    refresh().catch((reason) => setError(String(reason)));
  }, [userId]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReadingFile(true); setError("");
    try {
      const extracted = await readDocumentLocally(file);
      const document: BrowserDocument = {
        id: crypto.randomUUID(),
        ownerId: userId,
        name: file.name,
        content: extracted.content,
        mediaType: extracted.mediaType,
        classification: classifyInBrowser(extracted.content),
        createdAt: Date.now(),
      };
      await saveBrowserDocument(document, userId);
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
        let operation = "structured_minilm_mmr_summary";
        try {
          summary = await summarizeWithMiniLM(selected.content, summaryWordBudget);
        } catch {
          summary = summarizeStructured(selected.content, summaryWordBudget);
          operation = "structured_fallback_summary";
        }
        receipt = {
          receipt_id: crypto.randomUUID(),
          worker_id: "browser-local-client",
          tier: "local",
          operation,
          word_budget: summaryWordBudget,
          processing_ms: Math.round((performance.now() - started) * 1000) / 1000,
        };
      } else {
        const response = await fetch(`${CONTROL_API}/api/browser/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            document_id: selected.id,
            document_name: selected.name,
            content: selected.content,
            selected_tier: placement.selectedTier,
            reported_sensitivity: selected.classification.sensitivity,
            word_budget: summaryWordBudget,
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
      await saveBrowserDocument(updated, userId);
      await refresh();
      setSelectedId(updated.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setProcessing(false);
    }
  };

  const prepareSearch = async () => {
    const unindexed = documents.filter((document) => !document.searchPassages?.length);
    if (!unindexed.length) return;
    setProcessing(true); setError("");
    try {
      for (const document of unindexed) {
        const searchPassages = await createSearchIndex(document.content);
        await saveBrowserDocument({
          ...document,
          searchPassages,
          embeddingModel: "all-MiniLM-L6-v2",
          receipt: document.receipt,
        }, userId);
      }
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local MiniLM indexing failed");
    } finally {
      setProcessing(false);
    }
  };

  const searchLocally = async () => {
    if (!query.trim()) return;
    const indexed = documents.filter((document) => document.searchPassages?.length);
    if (!indexed.length) {
      setError("Prepare search before searching.");
      return;
    }
    setProcessing(true); setError("");
    try {
      const [queryVector] = await embedTexts([query.trim()]);
      const results = indexed.map((document): BrowserSearchResult => {
        const matches = document.searchPassages!.map((passage) => {
          const rawCosine = dot(queryVector, passage.embedding);
          const calibrated = calibrateScore(rawCosine, query.trim(), passage.text);
          return {
            passage: passage.text,
            score: calibrated,
          };
        }).sort((left, right) => right.score - left.score);
        return {
          documentId: document.id,
          name: document.name,
          sensitivity: document.classification.sensitivity,
          score: matches[0].score,
          matchingPassage: matches[0].passage,
        };
      }).sort((left, right) => right.score - left.score);
      setSearchResults(results.slice(0, 6));
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
        id: `demo-${userId}-${index}`,
        ownerId: userId,
        name: sample.name,
        content: sample.content,
        mediaType: "text/plain",
        classification: classifyInBrowser(sample.content),
        createdAt: createdAt + index,
      }, userId);
    }
    await refresh();
    setSelectedId(`demo-${userId}-0`);
  };

  const indexedCount = documents.filter((document) => document.searchPassages?.length).length;

  const remove = async () => {
    if (!selected) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    await removeBrowserDocument(selected.id, userId);
    setSelectedId("");
    setDeleteArmed(false);
    setDecision(null);
    await refresh();
  };

  return (
    <div className="workspace">
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Dismiss" onClick={() => setError("")}>×</button></div>}

      <section className="page-heading">
        <h1>{page === "files" ? "Files" : "Smart Search"}</h1>
        {page === "files" && (
          <div className="page-actions">
            <button className="button button-quiet" onClick={loadDemoSet}>Load demo files</button>
            <label className="button button-primary">
              {readingFile ? "Adding file…" : "Upload document"}
              <input disabled={busy} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={upload} />
            </label>
          </div>
        )}
      </section>

      {page === "search" ? (
        <section className="search-page">
          {!documents.length ? (
            <div className="empty-panel"><h2>No files yet</h2><p>Add a document before searching.</p></div>
          ) : (
            <>
              <div className="search-tools">
                <div className="search-line">
                  <IconSearch size={18} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchLocally()} placeholder="Search your files" aria-label="Search your files" />
                  <button className="button button-primary" disabled={busy || !indexedCount || !query.trim()} onClick={searchLocally}>
                    {busy ? "Searching…" : "Search"}
                  </button>
                </div>
                <div className="search-footer">
                  {indexedCount === documents.length ? <span>Ready to search</span> : <button className="text-button" disabled={busy} onClick={prepareSearch}>{busy ? "Preparing…" : "Prepare search (" + (documents.length - indexedCount) + " files)"}</button>}
                  <span className="local-note"><IconShield size={14} /> On this device</span>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="results-list">
                  {searchResults.map((result) => (
                    <button key={result.documentId} className="result-row" onClick={() => { setSelectedId(result.documentId); setSearchResults([]); setDecision(null); setDeleteArmed(false); onOpenFile(); }}>
                      <span className="result-main"><strong>{result.name}</strong><span>{highlightQuery(result.matchingPassage, query)}</span></span>
                      <span className="result-side"><em className={badgeClass(result.sensitivity)}>{result.sensitivity}</em><small>{result.score}% match</small></span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <div className="files-layout">
          <section className="panel files-panel">
            <div className="panel-heading"><h2>Your files</h2><span>{documents.length}</span></div>
            {documents.length ? (
              <div className="file-list">
                {documents.map((document) => (
                  <button key={document.id} className={selected?.id === document.id ? "file-row selected" : "file-row"} onClick={() => { setSelectedId(document.id); setDecision(null); setDeleteArmed(false); }}>
                    <span className="file-type">{document.mediaType === "application/pdf" ? "PDF" : "TXT"}</span>
                    <span className="file-name">{document.name}</span>
                    <em className={badgeClass(document.classification.sensitivity)}>{document.classification.displayName}</em>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-panel"><h2>Your files will appear here</h2><p>Upload a text file or PDF, or load the demo files.</p></div>
            )}
          </section>

          <section className="panel detail-panel">
            {selected ? (
              <>
                <div className="detail-heading"><h2>{selected.name}</h2><em className={badgeClass(selected.classification.sensitivity)}>{selected.classification.displayName}</em></div>
                <div className="privacy-note"><p>{selected.classification.reasons.join(" ")}</p><span>Allowed: {selected.classification.allowedDestinations.join(" · ")}</span></div>
                <details className="document-preview"><summary>Preview file</summary><pre>{selected.content.slice(0, 700)}{selected.content.length > 700 ? "…" : ""}</pre></details>
                <div className="processing-controls">
                  <label className="slider-control"><span><b>Latency</b><b>Energy</b></span><input aria-label="Balance latency and energy" type="range" min="0" max="100" value={latencyWeight} onChange={(event) => setLatencyWeight(Number(event.target.value))} /></label>
                  <label className="scenario-control"><span>Worker scenario</span><select value={scenario} onChange={(event) => setScenario(event.target.value)}>
                    <option value="live">Live worker state</option><option value="client_busy">Device busy</option><option value="edge_busy">Edge busy</option><option value="client_and_edge_busy">Device and edge busy</option>
                  </select></label>
                </div>
                <div className="detail-actions">
                  <label className="summary-length">Summary length<select aria-label="Summary length" disabled={busy} value={summaryWordBudget} onChange={(event) => setSummaryWordBudget(Number(event.target.value))}>
                    <option value={120}>Brief · up to 120 words</option>
                    <option value={200}>Standard · up to 200 words</option>
                    <option value={320}>Detailed · up to 320 words</option>
                    <option value={450}>Comprehensive · up to 450 words</option>
                  </select></label>
                  <button className="button button-primary" disabled={busy} onClick={summarize}>{busy ? "Summarizing…" : selected.summary ? "Regenerate summary" : "Evaluate & summarize"}</button>
                  <button className="text-button danger" onClick={remove}>{deleteArmed ? "Confirm remove" : "Remove file"}</button>
                </div>
              </>
            ) : <div className="empty-panel"><p>Select a file to see its details.</p></div>}
          </section>
        </div>
      )}

      {page === "files" && decision && (
        <section className="panel result-panel">
          <div className="panel-heading"><h2>{decision.selectedTier ? "Run on " + decision.selectedTier : "No available destination"}</h2>{decision.selectedTier && <span className="selected-label">Selected</span>}</div>
          <p className="decision-explanation">{decision.explanation}</p>
          <div className="candidate-list">
            {decision.candidates.map((candidate) => (
              <article key={candidate.tier} className={"candidate-row " + (candidate.selected ? "chosen" : "") + (!candidate.privacyAllowed ? " blocked" : "")}>
                <div className="candidate-title">
                  {candidate.tier === "local" ? <IconLaptop size={17} /> : candidate.tier === "edge" ? <IconServer size={17} /> : <IconCloud size={17} />}
                  <strong>{candidate.tier}</strong>
                  <span>{candidate.selected ? "Selected" : !candidate.privacyAllowed ? "Blocked" : candidate.available ? "Available" : "Offline"}</span>
                </div>
                <div className="candidate-metrics"><span>Latency <b>{formatMs(candidate.predictedLatencyMs)}</b></span><span>Energy <b>{formatEnergy(candidate.estimatedDeviceEnergyJ)}</b></span></div>
                <p>{candidate.reason}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {page === "files" && selected?.summary && (
        <SummaryPanel key={`${selected.id}:${selected.summary}`} summary={selected.summary} filename={selected.name} receipt={selected.receipt} tier={selected.summaryTier} />
      )}
    </div>
  );
}
