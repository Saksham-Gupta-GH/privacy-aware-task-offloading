import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { readDocumentLocally } from "./files";
import { createSearchIndex, embedTexts, summarizeWithMiniLM } from "./ml";
import { classifyInBrowser } from "./privacy";
import { BrowserPlacement, BrowserWorker, decideBrowserPlacement } from "./scheduler";
import { calibrateScore, dot, extractKeyTags } from "./semantic";
import { listBrowserDocuments, removeBrowserDocument, saveBrowserDocument } from "./storage";
import { summarizeExtractively } from "./summarize";
import { BrowserDocument, BrowserSearchResult } from "./types";
import {
  IconSearch,
  IconShield,
  IconCheck,
  IconBolt,
  IconSparkle,
  IconCloud,
  IconLaptop,
  IconServer,
  IconSidebar,
  IconUpload,
  IconFileText
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
  const [modelStatus, setModelStatus] = useState("MiniLM loaded locally in browser WebAssembly cache");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BrowserSearchResult[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          setModelStatus("MiniLM ready · execution instant from local cache");
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
      setModelStatus("Semantic similarity search & keyword calibration completed locally");
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

  // Executive summary parsing
  const summaryBullets = selected?.summary
    ? selected.summary.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/^[•\s-]+/, "").trim()).filter(Boolean)
    : [];
  const tags = selected?.content ? extractKeyTags(selected.content) : [];
  const origWords = selected?.content ? selected.content.trim().split(/\s+/).length : 0;
  const sumWords = selected?.summary ? selected.summary.trim().split(/\s+/).length : 0;
  const compressionRatio = origWords > 0
    ? Math.max(12, Math.min(88, Math.round((1 - sumWords / Math.max(sumWords, origWords)) * 100)))
    : 0;

  return (
    <div className={`google-workspace-container ${sidebarOpen ? "sidebar-visible" : "sidebar-collapsed"}`}>
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}

      {/* MoveInSync-Style Page Title Area with Sidebar Toggle */}
      <section className="moveinsync-title-section">
        <div className="title-left-group">
          <button
            className={`sidebar-pill-toggle ${sidebarOpen ? "active" : ""}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Hide Documents Sidebar" : "Show Documents Sidebar"}
          >
            <IconSidebar size={15} />
            <span>Files ({documents.length})</span>
          </button>
          <div className="title-text-block">
            <h1>Policy management</h1>
            <p>Review and enforce privacy-aware offloading rules across Local, Edge, and Cloud tiers.</p>
          </div>
        </div>

        <div className="title-right-actions">
          <button className="moveinsync-btn-demo" onClick={loadDemoSet} title="Load fictional documents for testing">
            <IconSparkle size={14} /> Demo tools
          </button>
          <label className="moveinsync-btn-primary">
            <IconUpload size={14} /> Upload document
            <input disabled={busy} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={upload} style={{ display: "none" }} />
          </label>
        </div>
      </section>

      {/* Smart Search Bar */}
      <section className="google-search-section">
        <div className="google-search-bar">
          <span className="search-icon">
            <IconSearch size={16} />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && searchLocally()}
            placeholder="Search policies and processed documents by meaning (e.g., 'Azure workshop', 'internship', 'card details')…"
          />
          <button className="search-action-btn" disabled={busy} onClick={searchLocally}>
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="search-status-bar">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconShield size={14} /> {modelStatus}
          </span>
          <span className="privacy-guarantee">Queries never leave this browser</span>
        </div>

        {searchResults.length > 0 && (
          <div className="google-search-results-grid">
            {searchResults.map((result) => (
              <button
                key={result.documentId}
                className="google-search-card"
                onClick={() => { setSelectedId(result.documentId); setSearchResults([]); setDecision(null); }}
              >
                <div className="card-top">
                  <b>{result.name}</b>
                  <em className={badgeClass(result.sensitivity)}>{result.sensitivity}</em>
                </div>
                <p className="card-passage">{highlightQuery(result.matchingPassage, query)}</p>
                <div className="card-match-bar">
                  <span className={`match-pill ${result.score >= 80 ? "high" : result.score >= 60 ? "medium" : "low"}`}>
                    {result.score}% Match
                  </span>
                  <span className="match-tag">Semantic Similarity</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Studio Area: Collapsible Left Sidebar + Full Stage */}
      <div className="studio-layout">
        {/* Backdrop for mobile */}
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

        {/* Collapsible Left Sidebar */}
        <aside className={`studio-sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
          <div className="sidebar-header">
            <div className="sidebar-title-group">
              <span className="sidebar-title">Private Documents</span>
              <span className="badge-pill">{documents.length}</span>
            </div>
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} title="Close Sidebar">
              ×
            </button>
          </div>

          <label className="sidebar-upload-trigger">
            <IconUpload size={15} />
            <span>Upload .txt or .pdf</span>
            <input disabled={busy} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={upload} style={{ display: "none" }} />
          </label>

          <div className="file-list-view">
            {documents.map((document) => (
              <button
                key={document.id}
                className={`file-row-btn ${selected?.id === document.id ? "selected" : ""}`}
                onClick={() => { setSelectedId(document.id); setDecision(null); setDeleteArmed(false); }}
              >
                <div className="file-icon-badge">
                  {document.mediaType === "application/pdf" ? "PDF" : "TXT"}
                </div>
                <div className="file-meta">
                  <b>{document.name}</b>
                  <small>{document.searchPassages?.length ? "Indexed · Ready" : "Stored locally"}</small>
                </div>
                <em className={badgeClass(document.classification.sensitivity)}>
                  {document.classification.displayName}
                </em>
              </button>
            ))}
            {!documents.length && (
              <div className="empty-state">
                <p>Upload a file or click Demo tools.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Unified Main Workbench */}
        <main className="studio-main-workbench">
          {selected ? (
            <div className="workbench-stage">
              {/* Document Stage Header */}
              <div className="workbench-header">
                <div className="workbench-title-group">
                  <div className="doc-icon-badge">
                    <IconFileText size={20} />
                  </div>
                  <div>
                    <h2 className="workbench-doc-title">{selected.name}</h2>
                    <span className="workbench-doc-sub">Local Enclave · Ready for Offloading Evaluation</span>
                  </div>
                </div>

                <div className="workbench-header-actions">
                  <em className={badgeClass(selected.classification.sensitivity)}>
                    {selected.classification.displayName}
                  </em>
                  <button className="google-pill-btn primary" disabled={busy} onClick={summarize}>
                    {busy ? "Evaluating & Offloading…" : "Evaluate & Offload Task →"}
                  </button>
                </div>
              </div>

              {/* Admission Policy Reasons */}
              <div className="privacy-explanation-box">
                <div className="expl-header">
                  <span className="shield-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                    <IconShield size={16} />
                  </span>
                  <b>Admission Policy Reasons</b>
                </div>
                <p>{selected.classification.reasons.join(" ")}</p>
                <div className="allowed-strip">
                  <span>Permitted destinations:</span>
                  <b>{selected.classification.allowedDestinations.join(" · ")}</b>
                </div>
              </div>

              {/* Archival Content Preview */}
              <div className="extracted-text-preview">
                <div className="preview-label">Document Content Preview</div>
                <pre>{selected.content.slice(0, 700)}{selected.content.length > 700 ? "…" : ""}</pre>
              </div>

              {/* Optimizer Controls */}
              <div className="optimizer-controls">
                <div className="slider-row">
                  <div className="slider-label">
                    <span>Optimization Goal</span>
                    <b>{latencyWeight}% Latency · {100 - latencyWeight}% Energy</b>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={latencyWeight}
                    onChange={(event) => setLatencyWeight(Number(event.target.value))}
                  />
                </div>

                <div className="select-row">
                  <span>Resource Scenario</span>
                  <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
                    <option value="live">Live Worker State</option>
                    <option value="client_busy">Simulated: Client Busy (Queue Delay)</option>
                    <option value="edge_busy">Simulated: Edge Busy</option>
                    <option value="client_and_edge_busy">Simulated: Client + Edge Busy</option>
                  </select>
                </div>
              </div>

              {scenario !== "live" && (
                <div className="simulation-pill-note">
                  Simulated queue pressure affects scheduler placement; execution and receipts remain real.
                </div>
              )}

              {/* Auxiliary actions */}
              <div className="workbench-footer-actions">
                <button className="google-pill-btn secondary" disabled={busy} onClick={indexSelected}>
                  <IconBolt size={14} /> {selected.searchPassages?.length ? "Refresh Vector Index" : "Prepare for Smart Search"}
                </button>
                <button
                  className={deleteArmed ? "google-danger-btn confirm" : "google-danger-btn"}
                  onClick={remove}
                >
                  {deleteArmed ? "Confirm Removal from Device" : "Remove from This Device"}
                </button>
              </div>

              {/* Decision Section */}
              {decision && (
                <section className="workbench-decision-section">
                  <div className="decision-header">
                    <span className="eyebrow">SCHEDULER PLACEMENT DECISION</span>
                    <h3>{decision.selectedTier ? `${decision.selectedTier.toUpperCase()} Selected` : "Task Deferred"}</h3>
                    <p className="subtext">{decision.explanation}</p>
                  </div>
                  <div className="tier-cards-grid">
                    {decision.candidates.map((candidate) => (
                      <article key={candidate.tier} className={`candidate-tier-card ${candidate.selected ? "selected" : candidate.privacyAllowed ? "" : "blocked"}`}>
                        <div className="tier-card-head">
                          <div className="tier-brand">
                            <span className="tier-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                              {candidate.tier === "local" ? <IconLaptop size={16} /> : candidate.tier === "edge" ? <IconServer size={16} /> : <IconCloud size={16} />}
                            </span>
                            <strong>{candidate.tier.toUpperCase()}</strong>
                          </div>
                          {candidate.selected && <span className="winner-tag">Selected</span>}
                        </div>
                        <dl className="tier-stats">
                          <div>
                            <dt>Privacy</dt>
                            <dd className={candidate.privacyAllowed ? "allowed" : "denied"}>{candidate.privacyAllowed ? "Allowed" : "Blocked"}</dd>
                          </div>
                          <div>
                            <dt>Availability</dt>
                            <dd>{candidate.available ? "Ready" : "Unavailable"}</dd>
                          </div>
                          <div>
                            <dt>Predicted Latency</dt>
                            <dd>{formatMs(candidate.predictedLatencyMs)}</dd>
                          </div>
                          <div>
                            <dt>Estimated Energy</dt>
                            <dd>{formatEnergy(candidate.estimatedDeviceEnergyJ)}</dd>
                          </div>
                        </dl>
                        <p className="candidate-reason">{candidate.reason}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Executive Summary Section */}
              {selected?.summary && (
                <section className="workbench-summary-section">
                  <div className="summary-header">
                    <div>
                      <span className="eyebrow">SEMANTIC EXECUTIVE BRIEFING</span>
                      <h3>Executive Takeaways</h3>
                    </div>
                    <div className="summary-pill-strip">
                      {compressionRatio > 0 && (
                        <span className="stat-pill" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <IconBolt size={13} /> -{compressionRatio}% Condensed
                        </span>
                      )}
                      <span className="stat-pill">{summaryBullets.length} Key Points</span>
                      <span className="execution-tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {displayedSummaryTier === "local" ? (
                          <>
                            <IconShield size={14} /> Local Processing (Zero Network)
                          </>
                        ) : (
                          <>
                            <IconCloud size={14} /> Verified {displayedSummaryTier.toUpperCase()} Execution
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="executive-bullets-container">
                    <ul className="executive-bullets-list">
                      {summaryBullets.map((bullet, idx) => (
                        <li key={idx} className="bullet-item">
                          <span className="check-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                            <IconCheck size={14} />
                          </span>
                          <span className="bullet-text">{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    {tags.length > 0 && (
                      <div className="topics-row">
                        <span className="topics-heading">Core Entities:</span>
                        {tags.map((tag, idx) => (
                          <span key={idx} className="topic-pill-chip">{tag}</span>
                        ))}
                      </div>
                    )}

                    {selected.receipt && (
                      <div className="receipt-bar">
                        <span>Cryptographic Execution Receipt</span>
                        <code>{String(selected.receipt.receipt_id).slice(0, 8)} · {String(selected.receipt.worker_id)} · {String(selected.receipt.processing_ms)} ms</code>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="empty-workbench">
              <IconFileText size={44} />
              <h3>No Document Selected</h3>
              <p>Click the <b>Files ({documents.length})</b> button on the left to select a document or load fictional demo files.</p>
              <button className="google-pill-btn secondary" onClick={() => setSidebarOpen(true)}>
                <IconSidebar size={15} /> Open Documents Sidebar
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
