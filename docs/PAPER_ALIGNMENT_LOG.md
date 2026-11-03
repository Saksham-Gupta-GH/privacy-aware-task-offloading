# Paper alignment and revision log

## Baseline and workflow

User instruction recorded on 2026-11-03 (Asia/Calcutta): notify the user whenever
work differs from the research paper and record the difference here so the paper
can be revised. This is a living log, not an assertion of full repository alignment.

- Paper: *Privacy-Aware Task Offloading in Mobile Edge Computing*.
- Supplied file: `C:/Users/Kushagar Gupta/Downloads/cloud_computing.pdf` (8 pages).
- SHA-256: `CBE9C48797FD30CC413F8EBD4419523D8EF659B9775F893B1D93C65A098C9F33`.
- Repository paper editing targets: `docs/paper.tex`, `docs/PAPER_DRAFT.md`.
- Review scope so far: summarization and this chat's local testing only. Other
  architecture, privacy, deployment, and numerical claims have not been audited.
- At log creation, no production summarization changes had been made during this
  chat. The first production preprocessing change is now recorded in A005.

For each future entry record: ID, date, status/origin, paper reference, old versus
new behavior, reason, affected files, validation and limits, required paper edit,
and whether the user has been notified. Mark paper edits complete only after
checking the revised text; retain the history.

## A001 - Existing MMR formula differences

- Date: 2026-11-03. Status: pre-existing discrepancy; paper edit pending.
- Paper: VIII-C, page 5, equations (11) and (12). The centroid is the arithmetic
  mean of normalized sentence embeddings; the score uses 0.72 relevance minus
  0.28 maximum similarity to an already selected sentence.
- Code: normalizes the centroid again to unit length and adds 0.04 to the first
  sentence's relevance before applying the 0.72 weight. These are existing
  behaviors, not changes introduced by this chat. Normalizing the centroid can
  change the relevance/redundancy tradeoff relative to the printed formula.
- Files: `frontend/src/browser/semantic.ts`, `privacydrive/summarizer.py`.
- Evidence: source inspection; synthetic-vector selection tests. Python execution
  was not available locally. No full mathematical equivalence claim is made.
- Paper action: specify the normalized centroid, first-sentence bonus, and the
  zero-redundancy convention on the first selection, or separately authorize a
  code change to match the printed algorithm.
- User notification: given in the chat establishing this log.

## A002 - Existing candidate limits and fallback behavior

- Date: 2026-11-03. Status: pre-existing omissions; paper edit pending.
- Paper: VIII-C, page 5 describes semantic MMR rather than frequency heuristics.
- Code: semantic selection considers at most the first 48 sentence units; the
  UI requests three. The browser falls back to word-frequency selection on
  semantic errors. Workers use frequency selection when no embedder is present
  or the capped sentence count is no greater than the request. Embedding-count
  mismatch in the selector returns all candidate sentences, potentially exceeding
  the requested count. A redundancy penalty does not guarantee deduplication.
- Files: `frontend/src/browser/ml.ts`, `semantic.ts`, `summarize.ts`,
  `BrowserWorkspace.tsx` (all under `frontend/src/browser/`),
  `privacydrive/summarizer.py`, `privacydrive/worker_api.py`.
- Evidence: code inspection and focused browser selection tests; the tests
  confirm tail exclusion, duplicate output, and oversized mismatch output.
- Paper action: document limits, default length, fallback triggers, and remaining
  quality limitations in VIII-C and XII. Distinguish source-text faithfulness
  from completeness or preservation of meaning when context is omitted.
- User notification: given in this chat. No production change made.

## A003 - Added local tests and real resume case

- Date: 2026-11-03. Status: test-only addition and evaluation finding.
- Paper: VIII-C (method), X (evaluation), XII (limitations).
- Change: added `frontend/src/browser/summarizer-focused.test.ts` with eight
  checks. Together with existing summary tests, 11 summarizer tests passed; an
  unrelated indexing test was skipped in the focused run. Some tests explicitly
  characterize limitations, so passing them is not evidence of good quality.
- Resume experiment: used the application's PDF extraction, sentence splitting,
  MiniLM q4 model, and MMR selection on a user-supplied private resume. Executed
  in Node on the local Windows machine with filesystem caching in place of the
  browser Cache API. This is not a browser WebAssembly or cloud benchmark.
  Model files were downloaded; resume text was processed locally.
- Observed result: 684 input words, 27 detected sentence units, 160 output words;
  selected units 3, 12, and 20. All units were inside the 48-unit cap.
- Qualitative finding: punctuation segmentation broke an abbreviation and merged
  headings, skills, and experience into a large unit. Output omitted key profile
  facts and included a project bullet without its heading. This is one case,
  not a general quality estimate or a human-rated benchmark.
- Production algorithm unchanged. Private source text, outputs, and the temporary
  harness were kept out of tracked files, under the ignored frontend dependency
  cache. They are not permanent reproducibility artifacts and may be removed by
  dependency reinstalls. Python tests were not run: no Python runtime installed.
- Paper action: if reporting this experiment, explicitly label its runtime and
  single-case scope, use an authorized anonymized fixture, and add structured-PDF
  segmentation/context limitations. Do not update cloud latency or energy tables
  from these results.
- User notification: results and limitations reported in this chat.

## A004 - Suggested improvements, not implemented

- Date: 2026-11-03. Status: proposed only; implementation not authorized by the
  request to establish this log.
- Suggestions: preserve headings and bullets; improve abbreviation handling;
  associate selected units with section/project context; add a word budget and
  coverage across sections; evaluate on manually identified key facts and several
  document types. Retain MiniLM initially. Generative rewriting is only a possible
  later alternative, not an agreed change.
- Paper impact if implemented: update VIII-C to describe segmentation, selection
  constraints, and length control; update X and XII with actual evaluation. If
  headings are attached, qualify the claim of verbatim sentence extraction. If
  generative rewriting is adopted, revise the extractive-only and hallucination
  claims and any affected runtime/privacy statements.
- Required validation: compare original and revised output using predeclared key
  facts, context, coverage, length, and readability; include non-resume inputs.
  Re-measure affected workloads before changing latency or energy claims.
- User notification: proposals discussed; no production changes made.

Historical status above reflects the proposal stage. Priority 1 was subsequently
authorized and implemented in A005; the other suggestions remain unimplemented.

## A005 - Preserve structural lines and protect abbreviations

- Date: 2026-11-03. Status: implemented; paper edit pending. User explicitly
  requested priority 1 and tests. This is a departure from the preprocessing
  described implicitly as sentence extraction in VIII-C, page 5.
- Previous behavior: flattened line breaks before sentence segmentation, allowing
  headings and lists to merge into oversized sentences; fallback could discard
  short lines or cut text into arbitrary 35-word chunks. Browser and Python
  splitting also differed because only the browser used Intl.Segmenter.
- New behavior: both implementations preserve each nonempty line as a structural
  boundary, normalize whitespace within lines, then split on sentence punctuation
  while protecting common titles, initials/initialisms, e.g./i.e., and numbered
  list prefixes. Short headings and bullet markers remain in the original order.
  Removed arbitrary 35-word splitting. The same rules now run in TS and Python.
- Files: `frontend/src/browser/summarize.ts`, `privacydrive/summarizer.py`;
  tests in `frontend/src/browser/segmentation.test.ts`,
  `tests/segmentation_cases.json`, `tests/test_summarizer.py`.
- Unchanged: MiniLM model, MMR scoring, first-unit bonus, three-unit UI request,
  48-unit semantic cap, frequency fallback, privacy policy and tier placement.
  No context attachment, coverage constraints or word budget were added.
- Validation: 22 frontend tests passed across four targeted files (including one
  indexing test); five Python summarizer tests passed, with nine shared structural
  fixtures checked in both languages. TypeScript build check and git whitespace
  check passed. A bundled Python runtime was discovered, resolving the earlier
  inability to execute Python tests; earlier entries describe earlier runs.
- Real resume retest: local Node with actual cached MiniLM q4, not a browser or
  cloud benchmark. Same 684-word input now yields 60 units versus 27 previously.
  Selected units 22, 37 and 41 yield 49 words versus 160 previously. The broken
  opening and giant merged unit are removed. Output still includes an internship
  heading without employer context and does not provide balanced profile coverage.
- Material interaction: the unchanged 48-unit cap now omits the last 12 units,
  including the fashion project details, open-source contributions and achievements.
  This test therefore demonstrates a segmentation improvement, not a general
  improvement in summary coverage or quality.
- Remaining limits: physical PDF line wraps also become boundaries and can produce
  fragments. Abbreviation rules are deliberately limited English heuristics and
  can suppress a true boundary after an initial/abbreviation. Headings are retained
  as standalone candidates; attaching them to content remains priority 2.
- Paper action: in VIII-C describe structural text units (lines, headings, bullets,
  and sentences within lines), abbreviation rules, and selection over the first
  48 units. Qualify the verbatim-source-sentences claim: outputs may contain source
  fragments/headings with normalized whitespace. Add segmentation/coverage limits
  to XII. If adding these tests to X, distinguish synthetic fixtures and one private
  resume case from a representative quality evaluation. Re-measure workloads before
  revising any timing or energy claims because candidate counts have changed.
- User notification: announced before implementation and reported with the resume
  tradeoffs after testing. The PDF and repository paper drafts were not rewritten.

## A006 - Context-aware, budgeted, grouped summaries across the document

- Date: 2026-11-03. Status: implemented locally; paper edit pending; not deployed.
  User authorized context-aware selection, a word budget, grouped output, whole-
  document candidate processing, section coverage, and tests.
- Paper references: VIII-A/C (page 5, runtime and extraction; equations 11–12),
  III-A/C (client/worker processing), IX–X (evaluation), XII (limitations).
- Old active behavior: select three units from the first 48 and concatenate with
  spaces. Headings could be selected alone, and facts lost employer/project context.
- New active behavior: parse sections and recognized entities, attach source-based
  context to facts, embed all candidate units in bounded batches, and return `##`
  section headings with separate `-` bullets. The UI preserves those boundaries
  instead of splitting and flattening the returned summary. Browser batches contain
  at most 16 units; the worker embedder retains its configured inference batch size.
- Length: maximum 180 whitespace-delimited tokens by default, including headings,
  bullet markers and context; API range 20–500. It is a maximum, not a minimum:
  short inputs can yield shorter summaries. Individual oversized facts are explicitly
  truncated with an ellipsis only when no complete candidate fits the budget.
- Selection: normalized centroid relevance and MMR retain 0.72/0.28 weights, but
  selection now adds a 0.35 relevance bonus for percentage/multiplier/GPA facts and
  a 0.12 bonus for an unrepresented section/context pair. Primary sections receive
  an initial selection pass (education, experience, projects, achievements/results/
  conclusion), then unrepresented employers, remaining sections, and budget filling.
  The old first-sentence bonus is not used in the new path. Exact normalized facts
  are deduplicated within their context; distinct employers are not conflated.
  These heuristic weights are engineering choices, not empirically optimized values.
- Context handling: recognized section/role/project headings remain attached to the
  selected fact. Role dates and link-label boilerplate may be omitted; a GPA value
  may be combined with the preceding degree fact while semester details are omitted.
  Obvious continuation lines are joined. There is no generative model, but output
  is no longer strictly verbatim complete source sentences.
- Fallback: missing/invalid vectors or browser inference failure use the same
  structural parser, grouping, coverage and budget with constant base relevance
  plus the documented heuristics. This is not word-frequency selection. Existing
  sentence-count functions remain regression baselines only, outside the active
  workspace and worker summary path; earlier A001/A002 describe those old helpers.
- API: browser/control-plane/gateway/worker propagate `word_budget`. The old
  `sentence_count` request field is accepted but deprecated and does not control
  active output. Structured operation identifiers and word budgets appear in
  receipts; workers also return candidate counts. The summary remains a string.
  Frontend, gateway/control plane and workers need coordinated deployment. Existing
  cached summaries are not silently regenerated.
- Files: `frontend/src/browser/structured-summary.ts`, `ml.ts`,
  `BrowserWorkspace.tsx`; `privacydrive/structured_summary.py`, `worker_api.py`,
  `public_gateway.py`, `orchestrator_api.py`; README and new summary/route tests.
- Validation: 31 targeted frontend tests, 12 Python summary/worker tests and eight
  gateway tests passed (51 total), plus TypeScript and git whitespace checks.
  Shared synthetic fixtures cover resumes, a research report and plain prose;
  checks cover employer/project attribution, GPA preservation, structured output,
  budgets, duplicates, invalid vectors and a conclusion after unit 65. A browser
  pipeline test confirms 66 units are embedded in five batches of at most 16.
  Worker HTTP tests replace native model inference with a stub while exercising
  real parsing/selection/response logic. Gateway tests mock remote requests and
  confirm budget forwarding and privacy rejection behavior; no live cloud call.
- Real resume retest: actual MiniLM q4 inference in local Node, with cached model
  files and filesystem caching (not browser WASM). Output contains 178 whitespace-
  delimited tokens including Markdown markers in six sections. It includes the
  degree/GPA, both internships with correct employers, the 168× result attributed
  to its project, an open-source contribution and achievements from the document
  tail. This is qualitative single-case evidence, not a general quality score.
  Personal inputs and results stay in ignored local cache files, not test fixtures.
- Remaining limitations: English heading/entity rules may misparse unfamiliar
  layouts, job titles, employer ordering or wrapped PDFs. Coverage is encouraged,
  not guaranteed under tight budgets; not every project/achievement is selected.
  Metadata is shortened by heuristics and must be evaluated for each document type.
  Processing the whole document can increase latency, memory and timeout risk.
- Paper action: rewrite VIII-C to specify source units, context extraction, batch
  processing, word budgeting, coverage passes, bonuses, deduplication and fallback.
  Amend equation 12 or describe it as the base score extended by these heuristics.
  Replace the strict verbatim-sentence claim with source-based structured extraction
  and qualify fidelity when context is parsed or text truncated. Update IX–X only
  with accurately scoped test evidence, and add the above limits to XII. Rebenchmark
  inference/transfer/latency/energy before changing any numerical performance claim
  or treating old scheduler calibration as measured for this new workload.
- User notification: announced before implementation and reported with test and
  resume results. No paper files, live services or deployment settings were changed.

## A007 - Legacy summarizer cleanup and production frontend rebuild

- Date: 2026-11-03. Status: implemented locally; paper edits pending in future user pass.
- Context: user authorized points (2) rebuild frontend, (3) restart workers, and (4) clean up legacy summarizer helpers, with paper revisions deferred.
- Changes:
  - Cleaned up legacy `summarize_extractively` and `summarize_semantically` in `privacydrive/summarizer.py`. Preserved `split_sentences` as the shared segmentation utility.
  - Updated `tests/test_summarizer.py` to focus solely on `split_sentences` segmentation.
  - Fixed test harness issue in `tests/test_summary_worker.py` (avoiding eager model download during TestClient lifespan).
  - Fixed JSX escaped string delimiter test in `frontend/src/browser/SummaryPanel.test.tsx`.
  - Rebuilt production frontend bundle (`frontend/dist/`) via `tsc -b && vite build`.
- Verification:
  - All 41 frontend vitest tests passed (`pnpm test`).
  - All 25 Python pytest tests passed (`python -m pytest tests/`).
  - Production frontend bundle rebuilt successfully.
- Deployment note: Edge and Cloud workers run on external nodes (`D:\PrivacyDriveEdge` on local machine and Azure VM); to complete live runtime update, restart them with `start_edge_worker.ps1` and `start_cloud_worker.sh` after copying `privacydrive/structured_summary.py`.


## A008 - Generalized domain-agnostic structured text summarization

- Date: 2026-11-03. Status: implemented locally; paper edits pending in future user pass.
- Context: replaced resume-tailored section and entity heuristics with a domain-agnostic,
  structure-aware extractive summarization pipeline that works uniformly across resumes,
  job descriptions, technical documents, and plain prose.
- Key Changes:
  - Replaced hardcoded resume section dictionary with structural heading detection
    (markdown headers, colon-terminated titles like "About Us:", "Role Details:", and all-caps headings).
  - Added universal bullet-point glyph normalization (-, *, ?, ?, ?, ?, numbered lists).
  - Added tabular/key-value row recognition ("Job Location: Mumbai", "Stipend: 20,000")
    so structured job specifications don't get flattened into a single arbitrary section.
  - Replaced hardcoded section priority lists with balanced multi-pass semantic MMR:
    * Pass 1 (Breadth): covers each detected section with its highest-relevance unit.
    * Pass 2 (Depth): fills the remaining word budget dynamically with the best candidate
      units across sections, penalizing section saturation.
  - Added expanded word budget dropdown options in the frontend workspace UI
    (Brief ~120w, Standard ~200w, Detailed ~320w, Comprehensive ~450w).
  - Synchronized TypeScript (`frontend/src/browser/structured-summary.ts`) and Python
    (`privacydrive/structured_summary.py`) implementations.
- Verification:
  - 42 of 42 frontend vitest tests passed.
  - 25 of 25 Python pytest tests passed (with added job posting test fixture).
  - Production frontend bundle rebuilt successfully.

## A009 - LaTeX paper evidence and implementation alignment pass

- Date: 2026-11-03. Status: paper-only correction; implementation unchanged.
  User authorized step-by-step strengthening for the IA3 submission.
- Paper sections: Abstract, III, VII--XIV and the architecture/scheduler figures.
- Corrected pre-existing evidence mismatches: the client testbed specification now
  matches the recorded 8 GB macOS 14.4.1 system; client/edge PyTorch measurements
  are distinguished from the Azure ONNX worker; unmeasured, linearly extrapolated
  128-passage client/edge values are now N/A; simulated predicted latency and
  model-estimated energy are labelled as such.
- Corrected unsupported security wording: receipts are no longer described as
  cryptographically signed; they are trace records containing SHA-256 output
  digests. Unconditional "zero leakage" and privacy-guarantee language was replaced
  with evaluated policy-violation results and enforcement conditional on the
  classifier label, policy and threat assumptions. The unverified gateway peak-RSS
  value below 30 MB was removed while retaining the implemented memory cap.
- Classifier result scope: 11/11 is now identified as a curated synthetic policy
  test, not a real-world accuracy estimate. The two expected Uncertain cases and
  the specific masked payment-card evidence test remain reported.
- Summarization alignment: VIII-C now describes the active generalized structured
  pipeline from A008, including source units, normalized centroid, 0.70/0.30 base
  MMR, metric/coverage/saturation heuristics, two-pass selection, word budgeting,
  deduplication and structural fallback. The paper no longer claims strictly
  verbatim complete sentences or compilation of Sentence-Transformers itself.
- Files: `docs/paper.tex`, `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: source-to-evidence review against `validation/RESULTS.md`, raw JSON
  benchmark artifacts, classifier tests, scheduler experiment output and active
  TypeScript implementation. No production code, deployment, model or measured
  result changed. LaTeX rendering remains to be performed in an environment with
  a TeX toolchain.
- Remaining paper action: create a saved reproducible artifact for every baseline
  row, expand classifier evaluation if time permits, and render/review the PDF.
- User notification: the planned paper-only alignment pass was announced before
  editing; final results reported after validation.

## A010 - Reproducible four-strategy scheduler evaluation

- Date: 2026-11-03. Status: evaluation tooling and evidence updated; production
  optimizer and website behavior unchanged.
- Paper sections: VI, VII, X and the scheduler comparison table.
- Previous evidence: the saved JSON contained the proposed optimizer's live alpha
  and power sweeps, while the paper's Always-Cloud and Latency-Only values were not
  emitted by the reproducible script. Several printed power and normalization
  constants also differed from calibration-v2.
- New evidence: `scripts/run_scheduler_experiments.py` evaluates Privacy-Aware,
  Always-Local, Always-Cloud and Latency-Only on the same five documents and worker
  state, recording latency, energy, violation count and selected-tier counts. The
  baseline scenario explicitly applies the existing 15,000 ms `client_busy` local
  queue delay. Live alpha and ±30% power sweeps remain separate and unchanged.
- Paper correction: the table now uses the generated baseline values; latency is
  labelled predicted, energy model-estimated, and the queue delay is disclosed.
  Energy and normalization parameters now match calibration-v2.
- Files: `scripts/run_scheduler_experiments.py`,
  `validation/results/scheduler-experiments.json`, `validation/RESULTS.md`,
  `docs/paper.tex`, `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: the script completed successfully, produced zero proposed violations,
  three Always-Cloud violations and two Latency-Only violations, and `git diff
  --check` passed. This is a calibrated simulation, not a new physical benchmark.
- Remaining limitation: the production browser contains a separate simplified
  placement parameter set; alignment of browser and Python calibration is pending
  and no claim of numerical browser/Python identity is made here.
- User notification: announced before the reproducibility change and numerical
  correction.

## A011 - Browser scheduler aligned with calibration-v2

- Date: 2026-11-03. Status: implemented locally; deployment pending.
- Paper sections: VI--VII (latency, energy and constrained optimizer), X
  (calibrated evaluation).
- Previous behavior: the browser used a separate simplified parameter set,
  omitted payload transfer time, normalized by 1,000 ms and 1 J, and represented
  busy scenarios with 500/600 ms delays. Python evaluation used calibration-v2,
  transfer terms, 30,000 ms/30 J references and 15,000/20,000 ms scenario delays.
- New behavior: browser placement uses calibration-v2 processing, RTT, bandwidth,
  power, queue-delay and normalization values. Passage count comes from the active
  110-word overlapping indexing chunks; UTF-8 input and 384-float output sizes feed
  the same transfer formulas as Python. Privacy admission and availability checks
  remain unchanged.
- Files: `frontend/src/browser/scheduler.ts`,
  `frontend/src/browser/scheduler.test.ts`, `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: a new regression test checks the one-passage local prediction
  (38.4 ms, 0.096 J); all 45 frontend tests passed and the TypeScript/Vite
  production build completed. Existing selection tests cover Restricted local-only behavior,
  public Cloud selection under combined contention and offline Edge handling.
- Impact: displayed predictions and some tier decisions can change because the UI
  now uses the paper's calibrated model rather than demo-only constants. This is an
  intended alignment, not a new physical benchmark. Production remains unchanged
  until the rebuilt frontend is deployed.
- User notification: the behavior change and expected decision impact were
  announced before implementation.

## A012 - Browser and gateway privacy-rule parity

- Date: 2026-11-03. Status: implemented locally; deployment pending.
- Paper sections: V (privacy classification), III-B (dual-gate verification),
  XII (rule-based limitations).
- Previous behavior: the browser used a shortened early-return rule chain while
  the authoritative Python classifier used signal collection, Luhn validation,
  local public-contact context, order/reference exclusions and restrictive-class
  precedence. The gateway remained safe by rejecting label mismatches, but valid
  browser requests could fail unexpectedly.
- New behavior: TypeScript now mirrors the Python classifier's decision semantics:
  Luhn plus payment context, order exclusions, ambiguous long-number fallback,
  nearby public-contact markers, explicit personal markers, linked health data,
  and Restricted > Uncertain > Personal > Public precedence. Classification still
  runs locally before offloading and remains deterministic and explainable.
- Files: `frontend/src/browser/privacy.ts`, `privacy.test.ts`,
  `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: added hard-negative order ID, ambiguous number, mixed-sensitivity and
  public-directory tests in addition to the existing payment, public, personal and
  empty-input cases. All 50 frontend tests passed and the TypeScript/Vite production
  build completed.
- Limitations: this is stronger rule parity, not a learned privacy classifier and
  not evidence of general real-world accuracy. Gateway reclassification remains a
  deliberate independent enforcement boundary.
- User notification: the mismatch and privacy-first reason for resolving it before
  adding ML were announced before implementation.

## A013 - Expanded cross-runtime privacy policy benchmark

- Date: 2026-11-03. Status: evaluation evidence expanded; classifier model and
  production policy unchanged beyond the parity work in A012.
- Paper sections: Abstract and X-A (privacy classifier policy test).
- Previous evidence: 11 synthetic cases, including two expected Uncertain cases.
- New evidence: 20 additional adversarial synthetic cases cover public contact
  context, order/tracking hard negatives, general health prose, personal markers,
  two Luhn-valid test-card formats, invalid/repeated/unlabelled long numbers,
  identified medical data, confidentiality markers and restrictive precedence.
  The combined distribution is 9 Public, 5 Personal, 12 Restricted and 5
  Uncertain cases.
- Cross-runtime result: Python and TypeScript produced all 31 expected labels;
  Uncertain rate was 5/31 (16.1%). The evaluation script now prints confusion
  counts, and both runtimes consume the same additional JSON fixture.
- Files: `data/synthetic/privacy-adversarial-cases.json`,
  `scripts/evaluate_classifier.py`, `tests/test_classifier.py`,
  `frontend/src/browser/privacy.test.ts`, `docs/paper.tex`,
  `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: classifier evaluation reported 31/31; six Python classifier tests
  passed; all 50 frontend tests passed; the production build and `git diff
  --check` passed.
- Limitation: the test set is intentionally curated and synthetic, so 31/31 must
  not be presented as real-world accuracy, robustness to multilingual data, or
  machine-learning generalization. The paper states this limitation explicitly.
- User notification: the evaluation-first approach was announced before expansion.

## A014 - Related-work bibliographic corrections

- Date: 2026-11-03. Status: paper-only factual correction.
- Paper section: II-B and bibliography entries `gao2024` and `xu2023`.
- Previous text: the improved DDPG paper was attributed to Gao, Chen and Ding in
  FGCS volume 158, pages 112--124; the Xu service-caching work was listed as a
  2023 IEEE Transactions on Mobile Computing article.
- Corrected evidence: the DDPG article is by H. Zhang, L. Cao, N. Kumar, J. Zhang,
  P. Zhang and J. Wang, FGCS volume 159, pages 522--532, DOI
  10.1016/j.future.2024.05.018. The Xu work appeared at IEEE INFOCOM 2018,
  pages 207--215, DOI 10.1109/INFOCOM.2018.8485977.
- Files: `docs/paper.tex`, `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: checked against the publishers' indexed article metadata and the
  IEEE conference record. No implementation or experimental result changed.
- User notification: the two incorrect records were reported before correction.

## A015 - Final LaTeX compilation and layout verification

- Date: 2026-11-03. Status: paper source corrected and final PDF generated locally.
- Paper section: VII-A, equation (6), plus whole-document visual inspection.
- Finding: the single-line feasible-set equation exceeded the IEEE column width by
  approximately 63 pt and visibly overlapped the adjacent column.
- Correction: equation (6) now uses a two-line aligned layout without changing its
  mathematical definition.
- Validation: Tectonic 0.17.0 compiled the paper successfully to an eight-page,
  letter-sized PDF. All pages were rendered with Poppler and inspected as a contact
  sheet; the corrected fifth page was also inspected at higher resolution. No text,
  figure, table or equation clipping remains. Minor non-blocking TeX underfull and
  small title/paragraph overfull warnings remain without visible overlap.
- Outputs: final PDF under `output/pdf/` and self-contained LaTeX source ZIP under
  `submission/`; both generated directories are intentionally ignored by Git.
- Files: `docs/paper.tex`, `.gitignore`, `docs/PAPER_ALIGNMENT_LOG.md`.
- User notification: the visible equation defect and its correction were reported
  during the render-and-review workflow.

## A016 - Email punctuation classifier correction and slider-label repair

- Date: 2026-11-03. Status: implemented and deployed to Azure and Vercel.
- Paper sections: V (privacy classification), VII-B (latency-energy weighting),
  and XII (rule-based classifier limitations).
- Previous behavior: the shared Python and TypeScript email expressions rejected
  an otherwise valid address when normal sentence punctuation immediately followed
  its top-level domain. Consequently, the built-in fictional resume could be
  labelled Public instead of Personal. The placement slider increased the latency
  weight from left to right, but its visible endpoint labels stated the reverse.
- New behavior: a trailing full stop is treated as punctuation outside the email,
  so the fictional resume is classified Personal in both runtimes. The slider now
  reads Energy on the low-latency-weight end and Latency on the high-weight end.
  Privacy classes, permitted destinations, scheduling equations and calibration
  values are unchanged; this restores the behavior described by the paper.
- Files: `privacydrive/classifier.py`, `tests/test_classifier.py`,
  `frontend/src/browser/privacy.ts`, `frontend/src/browser/privacy.test.ts`,
  `frontend/src/browser/BrowserWorkspace.tsx`, and
  `docs/PAPER_ALIGNMENT_LOG.md`.
- Validation: seven Python classifier tests passed; the shared 31-case evaluation
  remained 31/31 with a 5/31 Uncertain rate; all 51 frontend tests passed; and the
  TypeScript/Vite production build completed. The complete Python discovery run
  reached an unrelated host limitation because the Mac's Python 3.9 build lacks
  `hashlib.scrypt`; classifier validation was unaffected. On Azure, both services
  returned HTTP 200 and the cloud worker returned a sectioned synthetic summary
  with operation `structured_minilm_mmr_summary` in 23.259 ms. GitHub commit
  `e351ef3` triggered the Vercel deployment; the live bundle fingerprint changed
  to `index-DW-mnFVV.js` and contains the corrected Energy-to-Latency control and
  fictional resume fixture. The public Azure gateway remained healthy afterward.
- Limitation: the classifier remains deterministic and rule based; this regression
  repair does not establish RFC-complete email parsing or real-world accuracy.
- Required paper edit: none. The correction matches the existing description of
  emails as Personal unless an explicit nearby public-contact marker is present.
- User notification: the implementation defects and the planned parity repair were
  reported before editing.

## A017 - User-supplied humanized paper prose

- Date: 2026-11-03. Status: incorporated and verified in the LaTeX paper.
- Source: user-supplied `cloud_computing_1.pdf`, an eight-page Microsoft Word
  rendering identified by the user as the non-AI/humanized version.
- Paper sections: Abstract; I--V; IX--XIV; Declaration. Equations, diagrams,
  tables, measurements, citations and bibliography were retained from the
  verified LaTeX source.
- Previous behavior: the submission LaTeX used the earlier polished academic
  prose even though the user's later Word/PDF version used substantially
  different wording.
- New behavior: the LaTeX prose now follows the wording and sentence structure
  of the supplied PDF. Obvious conversion defects (duplicated punctuation,
  broken words and missing mathematical labels) were corrected rather than
  copied. No implementation method, privacy policy, calibration parameter,
  experiment size or numerical result was changed.
- Files: `docs/human.tex`, `docs/paper.tex`, `docs/PAPER_ALIGNMENT_LOG.md`, and
  the regenerated paper PDF/LaTeX submission archive.
- Validation: Tectonic compiled the revised source twice without LaTeX errors or
  unresolved citations. The result remains an eight-page IEEE letter-size paper.
  All pages were rendered with Poppler and inspected as a contact sheet; pages 1,
  2, 5, 7 and 8 were also checked individually at 120 dpi. Equations, diagrams,
  tables, references and column boundaries remain legible with no clipping or
  overlap. The regenerated LaTeX archive passed `unzip -t` and its embedded
  `paper.tex` matches both repository paper sources byte for byte.
- Limitation: automated AI-text detectors are not reliable authorship tests, so
  no detector score is promised. This entry records only that the supplied human
  wording was transferred faithfully while preserving technical correctness.
- Required paper edit: completed in the LaTeX sources as part of this entry.
- User notification: the user requested that the LaTeX match the supplied
  humanized PDF and was informed that technical notation would be preserved.
