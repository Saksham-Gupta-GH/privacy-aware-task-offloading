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
