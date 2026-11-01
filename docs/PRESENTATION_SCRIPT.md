# PrivacyDrive presentation script (5–7 minutes)

## Slide 1 — Problem (40 seconds)

“In Mobile Edge Computing, a task can execute on the local phone or browser, a nearby edge server, or a remote cloud datacenter. Conventional schedulers optimize for speed or device battery, which can inadvertently dispatch sensitive personal or financial documents to untrusted cloud servers. Our project, PrivacyDrive, enforces privacy as a strict, non-negotiable admission constraint and then optimizes latency, client energy, availability, and deadlines across permitted tiers.”

## Slide 2 — Architecture & Threat Model (45 seconds)

Explain the three-tier hierarchy:
- **Local Client (Browser):** Contains raw documents, user search queries, vector embeddings, and task history. Uses in-browser WebAssembly Transformer inference (`all-MiniLM-L6-v2` ONNX q4).
- **Trusted Edge:** A physical laptop within the user's personal/campus network. Permitted for Public and Personal data; blocked for Restricted.
- **Public Cloud:** Azure VM with an ONNX MiniLM worker behind a lightweight, memory-capped gateway. Permitted *only* for Public data.

## Slide 3 — Policy and Optimizer (60 seconds)

Show the policy mapping:
- Public: Local, Edge, Cloud
- Personal: Local, Trusted Edge
- Restricted: Local only
- Uncertain: Local only (conservative fallback)

Say: “Privacy is not a weighted term that can be traded away for speed. A restricted document can never be sent to the cloud, even when the cloud is faster or the client is heavily loaded. The optimization slider balances latency and client energy only among already-permitted destinations.”

## Live Demonstration (3–4 minutes)

1. **Open Deployed Vercel Site:** Navigate to `https://privacy-aware-task-offloading.vercel.app`. Point out the top status strip showing Cloud `Ready` via the secure Azure HTTPS gateway.
2. **Load Fictional Demo:** Click **Load fictional demo**. Point out the automatic local classification:
   - `public_cloud_event.txt` -> **Public** (Local, Edge, Cloud allowed)
   - `personal_resume.txt` -> **Personal** (Local, Edge allowed; Cloud blocked)
   - `restricted_payment.txt` -> **Restricted** (Local only; Edge and Cloud blocked)
3. **In-Browser Smart Search:**
   - Click **Prepare for smart search** on the documents.
   - Show the model status: MiniLM runs inside browser WebAssembly; embeddings are stored in IndexedDB.
   - In the search bar, search semantically without exact keywords: e.g. `"candidate with programming experience"` or `"Azure cloud workshop"`. Show the ranked semantic match percentages.
4. **Local Semantic Summarization:**
   - Select `restricted_payment.txt` or a longer text and click **Evaluate & summarize**.
   - Show the resulting **SEMANTIC EXTRACTIVE SUMMARY** using MiniLM centroid relevance and MMR redundancy reduction.
   - Highlight the receipt: `browser-local-client`, `minilm_mmr_summary`, `0 ms network latency`.
5. **Cloud Offloading with Live Receipt:**
   - Select `public_cloud_event.txt`.
   - Set scenario to **Simulated: client busy**. The optimizer re-evaluates the tiers: Local is queued, Cloud is ready and permitted.
   - Click **Evaluate & summarize**.
   - Show the live verified receipt from the real Azure worker:
     - Worker: `azure-student-vm`
     - Tier: `cloud`
     - Operation: `minilm_mmr_summary`
     - Measured worker processing time in milliseconds.
6. **Hard Privacy Enforcement:**
   - Switch back to `restricted_payment.txt`.
   - Set the slider to 100% latency and select **client busy**.
   - Observe that Edge and Cloud remain strictly **Blocked** by policy; the optimizer selects **Local**, proving policy cannot be bypassed by load or preferences.
7. **Experiments & Baselines:**
   - Switch to the **Experiments** tab.
   - Point out that PrivacyDrive achieved **0 policy violations**, whereas Always-Cloud caused 3 violations and Latency-Only caused 2 violations.

## Slide 5 — Key Systems Findings (60 seconds)

- **Idle M1 vs. Edge:** The idle M1 client beat the idle Ryzen edge worker by 2.4×. Offloading is beneficial only under queuing pressure or battery conservation.
- **Constrained Cloud VM:** On a 1 GiB student VM, streaming batch size 1 avoided memory crashes and yielded stable 3.9 s response times for 32 passages.
- **In-Browser Neural Processing:** Quantized 4-bit ONNX models enable client-side intelligence without sending raw data over the network.

## Slide 6 — Limitations & Conclusion (45 seconds)

“PrivacyDrive is a research prototype demonstrating that task offloading can be simultaneously privacy-preserving, mathematically optimal, and auditable. The contribution is the end-to-end working system: explainable classification, strict admission control, in-browser neural search, and multi-tier execution receipts.”

---

## Likely Questions and Answers

**Q: Is PrivacyDrive just a regex sensitive file detector?**
A: No. Classification is only the first step (admission control). The core contribution is the constrained multi-objective scheduler that optimizes latency, client energy, worker availability, and deadlines across local, edge, and cloud tiers.

**Q: Why offload if the local Mac M1 is faster?**
A: Offloading is conditional. When a mobile device is running heavy background tasks, has a deep queue, or is critically low on battery, offloading non-sensitive tasks to permitted edge/cloud tiers frees local resources.

**Q: Does Azure store the user's documents?**
A: No. Workers and the public gateway are completely stateless at the application layer. They process requests in memory, generate embeddings/summaries, return receipts, and discard the text.
