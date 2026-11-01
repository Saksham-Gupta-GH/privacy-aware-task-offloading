# PrivacyDrive: Privacy-Aware Task Offloading for Mobile Edge Computing

> Author names, registration numbers, institution, and faculty guide: **add before final submission**.

---

## 1. Abstract

Mobile Edge Computing (MEC) enables resource-constrained mobile and browser clients to offload computational tasks to nearby edge nodes or remote cloud infrastructure. However, conventional offloading schedulers treat privacy as merely a weighted cost term or ignore it altogether, creating critical risks of data leakage when sensitive personal or restricted documents are dispatched to untrusted remote environments. In this paper, we present **PrivacyDrive**, a three-tier, privacy-aware task offloading system that enforces privacy as a strict, non-negotiable admission constraint before performing multi-objective optimization across latency, device energy, worker availability, and execution deadlines.

PrivacyDrive integrates a local, rule-based explainable privacy classifier with a mathematical placement optimizer and identical execution runtimes across client, edge, and cloud tiers. At the client tier, PrivacyDrive features a privacy-preserving browser workspace powered by in-browser WebAssembly neural inference using quantized `all-MiniLM-L6-v2` (q4 ONNX), local vector indexing in IndexedDB, and semantic Maximal Marginal Relevance (MMR) extractive summarization without network transmission. For offloaded tasks, identical sentence-transformer workers operate on a trusted physical edge laptop and an Azure cloud virtual machine behind a lightweight, memory-capped public gateway.

Across 11 synthetic benchmark test documents, the privacy classifier achieved 100% compliance with zero policy violations and an 18.2% conservative fallback rate for ambiguous inputs. In contrast, under calibrated client-busy queue pressure, standard always-cloud and latency-only baselines incurred three and two policy violations, respectively. Live physical experiments demonstrated that an idle client beat the idle edge by 2.30–2.44×, underscoring that offloading is beneficial only under queuing pressure or battery constraints. Furthermore, the Azure cloud worker adapted to a strict 1 GiB memory ceiling by streaming batch execution, completing 32 passages in a median 3.913 s and 128 passages in 15.441 s with signed cryptographic receipts. Our results demonstrate that hard privacy guarantees can be harmoniously integrated into edge-cloud task scheduling without sacrificing execution performance or transparency.

**Keywords:** Mobile Edge Computing (MEC), Computation Offloading, Privacy Classification, Task Scheduling, In-Browser Neural Inference, Transformers.js, Semantic Summarization.

---

## 2. Introduction

Multi-access Edge Computing (MEC) brings cloud-grade computation, storage, and machine learning inference to the network perimeter, reducing latency and relieving battery-powered mobile user equipment (UE) of heavy computational burdens [1]. In a modern hierarchical computing topology, an application task may execute on one of three distinct tiers:
1. **Local Client (UE / Browser):** Zero network latency and maximum privacy, but constrained by local battery life and processing power.
2. **Trusted Edge Server:** Low round-trip network latency and moderate compute capacity, assumed to operate within a trusted organizational or personal perimeter.
3. **Public Cloud Datacenter:** Virtually boundless computing scalability and elastic parallelism, but separated by wide-area network (WAN) latency, jitter, and untrusted third-party infrastructure.

While extensive research has explored the trade-off between execution latency and device energy consumption [2, 3], data privacy remains a critical blind spot in practical task offloading. Conventional approaches model privacy either by adding a penalty parameter to the cost function [4] or through reinforcement learning heuristics [5]. When privacy is treated merely as a soft objective, a document containing payment details, private health records, or proprietary source code may still be routed to an untrusted public cloud whenever network conditions appear favorable or the local device experiences temporary CPU load. Such decisions constitute catastrophic privacy failures regardless of execution speed.

To address this challenge, **PrivacyDrive** poses the core research question: *How can a mobile edge system guarantee absolute compliance with data-location privacy policies while dynamically optimizing latency and client energy under volatile resource availability and deadlines?*

The contributions of this work are fourfold:
1. **Hard Privacy Admission Control:** We implement an explainable, deterministic classification engine that maps document text into four strict sensitivity tiers (*Public*, *Personal*, *Restricted*, *Uncertain*), pre-filtering the feasible candidate set before any numerical cost optimization occurs.
2. **Multi-Objective Placement Optimizer:** We formulate and calibrate a constrained mathematical scheduler that balances normalized response latency and estimated device energy consumption against live queue depths, worker readiness, and deadlines, generating verifiable audit receipts.
3. **Client-Side Neural WebAssembly Engine:** We demonstrate a zero-leakage browser workspace that executes local Transformer embeddings (`all-MiniLM-L6-v2` ONNX) and semantic MMR summarization entirely within WebAssembly, retaining full semantic search and summarization capability even in offline or air-gapped environments.
4. **Physical Three-Tier Evaluation and Honest Systems Findings:** We evaluate the system across physical hardware (Apple M1 client, AMD Ryzen 5 edge laptop, and Azure cloud VM), reporting real-world negative results—such as an idle M1 outperforming an idle edge server—and demonstrating the necessity of load-contingent offloading policies.

---

## 3. Related Work

Computation offloading in mobile edge and fog computing has been widely studied. ETSI MEC standards formalize the interaction between user equipment and edge computing platforms [1]. Foundational algorithms primarily formulate offloading as a constrained optimization problem balancing execution delay and battery energy [2, 3]. Mao et al. survey dynamic computation offloading techniques focusing on Lyapunov optimization and convex relaxation [3].

Privacy-aware offloading has emerged as an active area of investigation. Zhu et al. investigate online task offloading under privacy constraints, modeling privacy risk as a quantitative information-theoretic metric integrated into a joint cost minimization objective [4]. Recent studies employ deep reinforcement learning (such as Deep Deterministic Policy Gradient, DDPG) to dynamically determine privacy sensitivity levels [5]. In addition, location and traffic-pattern privacy have been shown to create ancillary leakage risks during MEC task transmission [6].

However, many prior frameworks rely on synthetic simulations, abstract cost formulations, or soft penalties that allow sensitive data to be offloaded when latency gains are large. PrivacyDrive departs from soft penalty models by treating privacy as a non-negotiable boolean constraint. Moreover, whereas traditional MEC literature presumes client devices are incapable of executing modern deep learning models, recent advancements in WebAssembly (WASM) and quantized ONNX runtimes enable client-side Transformer inference. PrivacyDrive harnesses these capabilities to offer true zero-transmission semantic processing on the user's personal device.

---

## 4. Threat Model

We consider a multi-tenant edge computing ecosystem involving a mobile user, a trusted local edge host, and a multi-tenant public cloud infrastructure.

### 4.1 Candidate Tiers and Trust Assumptions
Let task $i$ have candidate execution destinations $j \in \{L, E, C\}$:
- **Local Client ($L$):** Fully trusted. Raw documents, user search queries, vector embeddings, and task audit logs reside exclusively on the client file system or IndexedDB storage.
- **Trusted Edge ($E$):** Trusted by operational assumption (e.g., an authenticated personal computer, campus node, or private edge server within the user's immediate administrative perimeter). The edge node executes tasks statelessly and purges in-memory payloads immediately after returning task receipts.
- **Public Cloud ($C$):** Honest-but-curious and untrusted with sensitive content. The cloud infrastructure is presumed to be secure against external intrusion, but multi-tenant infrastructure, third-party operators, and regulatory jurisdictions make it strictly ineligible for personal, confidential, or payment data.

### 4.2 Sensitivity Classes and Permitted Destinations
Each input task is classified into a sensitivity category $s_i \in \{\text{Public}, \text{Personal}, \text{Restricted}, \text{Uncertain}\}$, governing the allowable destination set $A_i$:
- **Public ($s_i = \text{Public}$):** Non-sensitive informational text (e.g., event announcements, publicly published documentation). Allowed destinations: $A_i = \{L, E, C\}$.
- **Personal ($s_i = \text{Personal}$):** Personally Identifiable Information (PII) such as personal emails, resumes, or phone numbers. Allowed destinations: $A_i = \{L, E\}$. Public cloud transmission is strictly prohibited.
- **Restricted ($s_i = \text{Restricted}$):** High-risk confidential records, including credit card numbers, authentication credentials, and identifiable health diagnoses. Allowed destinations: $A_i = \{L\}$. Network transmission is forbidden.
- **Uncertain ($s_i = \text{Uncertain}$):** Content exhibiting conflicting or low-confidence privacy indicators. By policy default, $A_i = \{L\}$, mandating local execution and manual user review before any potential reclassification.

### 4.3 Out-of-Scope Attacks
The threat model explicitly excludes physical device compromise, cold-boot memory extraction, side-channel timing analysis of packet lengths, and adversarial neural network inversion from vector embeddings.

---

## 5. System Architecture

PrivacyDrive implements a decoupled, three-tier architecture ensuring defense-in-depth across the web browser, control orchestrator, and execution tiers.

```
+-----------------------------------------------------------------------+
|                       CLIENT TIER (Web Browser / UE)                 |
|  - React + TypeScript User Interface                                  |
|  - In-Browser PDF/TXT Extractor (Line & EOL Reconstruction)           |
|  - Rule-Based Privacy Classifier (Deterministic, Explainable)        |
|  - Placement Optimizer (Latency vs. Energy vs. Availability)          |
|  - In-Browser Transformers.js (all-MiniLM-L6-v2 ONNX q4 WASM)         |
|  - Local Vector Store (IndexedDB) & Local Cosine Smart Search          |
|  - In-Browser Semantic MMR Extractive Summarization                   |
+-----------------------------------------------------------------------+
           |                                              |
      Local Only                                    HTTPS (Remote Tasks)
    (Restricted/Uncertain)                          (Public Tasks Only)
           |                                              |
           v                                              v
+-----------------------+              +--------------------------------+
| IndexedDB / RAM Cache |              |    AZURE PUBLIC GATEWAY (VM)   |
|  - Zero Network I/O   |              |  - Memory-Capped (<30 MB RAM)  |
|  - Data Never Leaves  |              |  - Independent Reclassification|
|    Local Device       |              |  - Strict CORS & Rate Limiting |
+-----------------------+              +--------------------------------+
                                                 |               |
                                      http://127.0.0.1:8001      | Reverse SSH
                                                 |               | 127.0.0.1:18001
                                                 v               v
                                        +----------------+ +------------+
                                        |  CLOUD WORKER  | | EDGE WORKER|
                                        | (Azure VM)     | | (HP Laptop)|
                                        | - MiniLM ONNX  | | - MiniLM   |
                                        | - Batch Size 1 | |   ONNX     |
                                        | - Audit Receipt| | - Receipt  |
                                        +----------------+ +------------+
```

### 5.1 Client Workspace and Local Storage
The client application is built with React and Vite. Users load documents via direct file upload (.txt, .pdf) or synthetic templates. Plain text and text-layer PDFs are parsed directly in the browser via `pdfjs-dist` using geometric coordinate clustering and end-of-line (`hasEOL`) tracking. Extracted documents, privacy classifications, generated vector indices, and task audit receipts are persisted in browser IndexedDB.

### 5.2 Lightweight Public Gateway
To bridge serverless web deployments (such as Vercel) with cloud and edge workers, we designed `privacydrive.public_gateway`. Unlike monolithic orchestrators, the gateway avoids loading memory-heavy libraries (such as PyTorch, ONNX Runtime, or NumPy), operating comfortably under a strict 30 MB RAM profile on resource-constrained cloud VMs. The gateway performs two functions:
1. **Independent Policy Verification:** Re-evaluates incoming document text using the authoritative `PrivacyClassifier`. If the reported sensitivity differs from the gateway's independent classification, or if the destination tier violates policy, the request is terminated with HTTP 409 (Conflict) or HTTP 403 (Forbidden).
2. **Stateless Request Proxying:** Permitted requests are dispatched to loopback workers over HTTP, returning execution receipts without persisting document content to disk.

### 5.3 Edge and Cloud Workers
Edge and cloud tiers run identical FastAPI services (`privacydrive.worker_api`). Each worker loads the pinned Sentence-Transformers `all-MiniLM-L6-v2` ONNX model with mask-aware mean pooling and unit-norm vector output. Workers bind strictly to `127.0.0.1:8001` and are reached exclusively through reverse SSH tunnels or local loopback, preventing unauthorized public exposure.

---

## 6. Privacy Classification

The classification module (`privacydrive.classifier` and `frontend/src/browser/privacy.ts`) implements a deterministic, rule-based expert system calibrated to synthetic document types.

### 6.1 Contextual Signal Detection
Rather than relying on brittle keyword searches or black-box classifiers, the engine inspects contextual combinations of regular expressions and semantic markers:
- **Payment Information:** Detected via Luhn-compatible 13–19 digit patterns correlated with financial terms (`credit card`, `cvv`, `expiry`, `billing`). Order numbers and invoice IDs serve as explicit negative guards to prevent false positives.
- **Personally Identifiable Contact Data:** Identified through RFC 5322 email patterns and E.164 phone sequences. If contextual headers indicate published corporate directories (`public directory`, `published contact`), the document is marked Public; otherwise, personal contact markers trigger a Personal label.
- **Confidential and Health Data:** Explicit confidentiality clauses (`strictly confidential`, `do not distribute`) and clinical terms (`diagnosis`, `prescription`, `patient name`) coupled with identity signals immediately elevate documents to Restricted status.

### 6.2 Priority Arbitration and Conservative Fallback
When multiple signals are present, arbitration follows a strict lattice:
$$\text{Restricted} \succ \text{Uncertain} \succ \text{Personal} \succ \text{Public}$$
If a document contains ambiguous markers or lacks confident classification features, it defaults to **Uncertain**. Under policy rules, Uncertain documents are restricted to local-only execution, ensuring that classification ambiguity never compromises data privacy.

---

## 7. Cost and Energy Model

When a task is cleared for offloading, the system evaluates predicted latency and client energy across all allowed and ready tiers.

### 7.1 Latency Formulation
For task $i$ executed locally ($j = L$), predicted response time is the sum of local processing duration and local queue latency:
$$T_{i,L} = T^{\text{proc}}_{i,L} + T^{\text{queue}}_{i,L}$$

For remote execution on edge or cloud ($j \in \{E, C\}$), latency incorporates communication overhead:
$$T_{i,j} = RTT_j + T^{\text{up}}_{i,j} + T^{\text{proc}}_{i,j} + T^{\text{queue}}_{i,j} + T^{\text{down}}_{i,j}$$
where $RTT_j$ is the network round-trip time, $T^{\text{up}}_{i,j} = \frac{D_i^{\text{in}}}{R^{\text{up}}_j}$ is upload transmission time for input size $D_i^{\text{in}}$ at bandwidth $R^{\text{up}}_j$, $T^{\text{proc}}_{i,j}$ is tier processing time, $T^{\text{queue}}_{i,j}$ represents queuing delay, and $T^{\text{down}}_{i,j} = \frac{D_i^{\text{out}}}{R^{\text{down}}_j}$ is receipt download time.

### 7.2 Client Energy Model
Energy expenditure is estimated specifically for the mobile client device. For local execution:
$$E_{i,L} = P^{\text{cpu}} \cdot T^{\text{proc}}_{i,L}$$
where $P^{\text{cpu}}$ is the active processor power consumption during inference.

For remote execution, client energy depends on network radio interface states:
$$E_{i,j} = P^{\text{tx}} \cdot T^{\text{up}}_{i,j} + P^{\text{idle}} \cdot \left(T^{\text{proc}}_{i,j} + T^{\text{queue}}_{i,j}\right) + P^{\text{rx}} \cdot T^{\text{down}}_{i,j}$$
where $P^{\text{tx}}$, $P^{\text{idle}}$, and $P^{\text{rx}}$ denote client transmit, idle wait, and receive power, respectively.

---

## 8. Constrained Placement Optimizer

The placement scheduler selects the optimal tier $j^* \in \{L, E, C\}$ through a two-phase filtering and scoring procedure.

### 8.1 Two-Phase Candidate Pruning
In Phase 1, the scheduler prunes the candidate set $C = \{L, E, C\}$ according to three mandatory boolean criteria:
1. **Privacy Permission:** $j \in A_i$ (Destination is permitted by the document's classification).
2. **Worker Availability:** Worker $j$ must report `available = true` and `ready = true`.
3. **Deadline Feasibility:** If the user specifies an optional deadline $D^{\max}_i$, the predicted latency must satisfy $T_{i,j} \le D^{\max}_i$.

The feasible set is defined as:
$$\mathcal{F}_i = \left\{ j \in \{L, E, C\} \;\middle|\; j \in A_i \;\land\; \text{Ready}(j) \;\land\; (D^{\max}_i = \emptyset \lor T_{i,j} \le D^{\max}_i) \right\}$$
If $\mathcal{F}_i = \emptyset$, the task is **deferred**, and the client is notified that no safe tier satisfies all constraints. Privacy is never relaxed.

### 8.2 Cost Function Optimization
In Phase 2, feasible candidates $j \in \mathcal{F}_i$ are evaluated using a normalized weighted cost objective $J_{i,j}$:
$$J_{i,j} = \alpha \frac{T_{i,j}}{T_{\text{ref}}} + (1 - \alpha) \frac{E_{i,j}}{E_{\text{ref}}}$$
where $\alpha \in [0, 1]$ represents the user's latency preference, $1 - \alpha$ represents energy sensitivity, and $T_{\text{ref}}$ and $E_{\text{ref}}$ are normalization constants. The scheduler selects:
$$j^* = \arg\min_{j \in \mathcal{F}_i} J_{i,j}$$

---

## 9. Browser MiniLM Search and Summarization

A key innovation of PrivacyDrive is its ability to perform high-quality semantic NLP directly inside the user's browser, eliminating data leakage for restricted content.

### 9.1 Quantized ONNX WebAssembly Inference
Client-side ML is implemented using `@huggingface/transformers` (Transformers.js v4.3.2) and ONNX Runtime Web. We utilize `onnx-community/all-MiniLM-L6-v2-ONNX` quantized to 4-bit precision (`q4`), yielding a compressed model payload of ~27 MB (~6.7 MB gzip). The browser downloads the model once from Hugging Face Hub and caches the weights in the browser's Cache API / IndexedDB storage. Subsequent model loads are instantaneous and function offline.

### 9.2 In-Browser Vector Search
1. **Passage Segmentation:** Documents are split into semantic paragraphs of up to 110 words.
2. **Embedding Generation:** The quantized MiniLM pipeline computes 384-dimensional normalized float32 vectors using mask-aware mean pooling:
   $$\mathbf{v} = \frac{\sum_{k=1}^K m_k \mathbf{h}_k}{\sum_{k=1}^K m_k}, \quad \hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2}$$
3. **Local Vector Search:** When the user enters a search query, the browser embeds the query locally and computes cosine similarities against stored passage vectors via dot products ($\text{sim}(\mathbf{q}, \mathbf{p}) = \mathbf{q} \cdot \mathbf{p}$). Documents and search queries never traverse the network.

### 9.3 Semantic MMR Summarization
Rather than relying on basic word frequency counters, PrivacyDrive implements semantic Maximal Marginal Relevance (MMR) extractive summarization:
1. Sentence embeddings $\mathbf{s}_1, \dots, \mathbf{s}_M$ are extracted locally.
2. A document centroid vector $\mathbf{c} = \frac{1}{M}\sum_{m=1}^M \mathbf{s}_m$ is computed and normalized.
3. Central, non-redundant sentences are selected iteratively by maximizing relevance while penalizing redundancy:
   $$\text{Score}(s_m) = 0.72 \cdot (\mathbf{s}_m \cdot \mathbf{c}) - 0.28 \cdot \max_{s_k \in \mathcal{S}_{\text{selected}}} (\mathbf{s}_m \cdot \mathbf{s}_k)$$
This guarantees a concise, diverse summary composed of original sentences, preserving factual accuracy without generative hallucinations.

---

## 10. Experimental Setup

The prototype was deployed and evaluated across a heterogeneous physical testbed:
- **Local Client (UE):** Apple MacBook Air (M1, 8-core CPU, 16 GB unified RAM), running macOS Sonoma.
- **Trusted Edge Server:** AMD Ryzen 5 5500U laptop (6 cores / 12 threads, 8 GB DDR4 RAM), running Windows 11 with OpenSSH Server and Python 3.12.
- **Cloud Worker:** Microsoft Azure Standard_B2ats_v2 virtual machine (2 burstable vCPUs, AMD EPYC 7763, 1 GiB RAM), running Ubuntu 24.04 LTS.

All workers ran the identical ONNX Runtime execution engine (`onnxruntime==1.19.2`) pinned to the Sentence-Transformers `all-MiniLM-L6-v2` repository commit `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`. Timing measurements were collected over warm-up runs and recorded as medians across repeated executions.

---

## 11. Baselines

To benchmark PrivacyDrive's constrained optimizer, we implemented three standard industry offloading strategies:
1. **Always-Local:** Executes all tasks on the client device regardless of workload size or battery status.
2. **Always-Cloud:** Dispatches every task to the public cloud server to maximize client energy savings.
3. **Latency-Only:** Greedily selects the destination with minimum predicted completion time, ignoring privacy sensitivity.

---

## 12. Results and Evaluation

### 12.1 Privacy Classification Accuracy
The classifier was evaluated against an annotated corpus of 11 synthetic documents spanning public events, corporate directories, personal resumes, credit card transactions, health records, order numbers, and mixed-privacy texts.
- **Policy Compliance:** The classifier achieved 11/11 (100%) expected labels.
- **Conservative Fallback:** Two ambiguous edge cases (18.2%) were categorized as Uncertain, correctly defaulting to local-only execution.
- **Signal Masking:** All detected credit card numbers, phone numbers, and email addresses were masked in audit logs.

### 12.2 Physical Workload Latency Comparison
Table 1 summarizes the median embedding computation time across passage counts:

| Passages | Apple M1 Client (ms) | AMD Ryzen 5 Edge (ms) | Idle Ratio (Edge / Client) |
|:---:|:---:|:---:|:---:|
| 1 | 18.51 ms | 42.49 ms | 2.30× |
| 32 | 441.01 ms | 1,076.32 ms | 2.44× |
| 128 | 1,764.20 ms | 4,305.20 ms | 2.44× |
| 512 | 7,343.94 ms | 17,614.59 ms | 2.40× |

*Key Systems Finding:* The idle M1 client consistently outperformed the idle Ryzen edge worker by ~2.4×. Cross-platform vector validation confirmed a cosine similarity of $1.0000000000$ (maximum component difference $< 7.45 \times 10^{-8}$). This demonstrates that static offloading rules based solely on device tier designations are flawed; offloading is justified only when the client is throttled, heavily queued, or constrained by battery power.

### 12.3 Azure Cloud Memory Adaptation
Initial cloud deployments of PyTorch on the 1 GiB Azure student VM suffered Out-Of-Memory (OOM) kernel terminations during 32-passage batch inference. Transitioning to ONNX Runtime with a strict streaming batch size of 1 successfully bounded peak memory consumption to ~320 MB. Median cloud performance was recorded as follows:
- 1 passage: 76.29 ms worker processing (518.67 ms end-to-end WAN latency).
- 32 passages: 2,389.97 ms worker processing (3,912.63 ms end-to-end WAN latency).
- 128 passages: 9,564.68 ms worker processing (15,441.44 ms end-to-end WAN latency).

### 12.4 Policy Violations under Queuing Scenarios
Under a calibrated scenario where the local client experiences queue contention:

| Offloading Policy | Tasks Processed | Policy Violations | Avg. Predicted Latency (ms) | Avg. Client Energy (J) |
|---|:---:|:---:|:---:|:---:|
| **PrivacyDrive (Proposed)** | 5 | **0** | 1,061.54 ms | 1.471 J |
| **Always-Local** | 5 | **0** | 918.80 ms | 2.297 J |
| **Always-Cloud** | 5 | **3** (60%) | 642.10 ms | 0.985 J |
| **Latency-Only** | 5 | **2** (40%) | 615.40 ms | 0.941 J |

PrivacyDrive achieved zero policy violations while successfully offloading public documents to cloud and personal documents to edge, reducing estimated device energy from 2.297 J down to 1.471 J.

### 12.5 Parameter Sensitivity Analysis
Sweeping the latency preference $\alpha$ from 0.0 to 0.75 maintained edge selection for public/personal documents and local execution for restricted documents (average latency 1,061.54 ms, energy 1.471 J). At $\alpha = 1.0$, the optimizer prioritized speed and kept all tasks local (918.80 ms, energy 2.297 J). Varying client power parameters by $\pm 30\%$ shifted estimated energy between 1.0298 J and 1.9125 J without altering tier selection or policy compliance.

---

## 13. Limitations

We acknowledge several real-world limitations:
1. **Rule-Based Classifier Scope:** The privacy engine relies on regular expressions and contextual term dictionaries, which are effective for standardized formats (cards, emails, credentials) but lack deep linguistic nuance across arbitrary multilingual text.
2. **Edge Trust Assumption:** The edge node is assumed to be trusted. While appropriate for private personal laptops, enterprise edge nodes require remote attestation (e.g., TPM/SGX) to defend against physical compromise.
3. **Model-Estimated Energy:** Device energy is estimated using empirically calibrated power models ($P^{\text{cpu}}, P^{\text{tx}}, P^{\text{rx}}, P^{\text{idle}}$) rather than hardware power meters.
4. **Document Modality:** The prototype processes textual documents and text-layer PDFs; scanned image PDFs requiring Optical Character Recognition (OCR) are safely rejected.

---

## 14. Conclusion

PrivacyDrive demonstrates that mobile edge computing can enforce strict, non-negotiable privacy boundaries without sacrificing multi-objective performance optimization. By treating data privacy as an upstream admission constraint rather than a soft cost penalty, the system guarantees zero data leakage for personal and restricted documents under arbitrary network and queue fluctuations. Furthermore, by pairing a lightweight cloud gateway with in-browser WebAssembly Transformer inference, PrivacyDrive provides full semantic search and summarization capabilities even in completely offline, local-only environments. Real-world systems evaluation confirms that transparent, privacy-first scheduling is both computationally feasible and practically viable for next-generation mobile edge computing.

---

## References

1. ETSI, “Multi-access Edge Computing (MEC); Framework and Reference Architecture,” ETSI GS MEC 003 V3.1.1, 2022.
2. H. Zhang, Y. Xiao, S. Bu, D. Niyato, F. R. Yu, and Z. Han, “Computing Resource Allocation and Latency Energy Tradeoff in Mobile Edge Computing Systems,” *IEEE Transactions on Wireless Communications*, vol. 17, no. 8, pp. 5606–5619, 2018.
3. Y. Mao, C. You, J. Zhang, K. Huang, and K. B. Letaief, “A Survey on Mobile Edge Computing: The Communication and Computing Perspective,” *IEEE Communications Surveys & Tutorials*, vol. 19, no. 4, pp. 2322–2358, 2017.
4. X. Zhu, C. Jiang, L. Kuang, N. Ge, and S. Guo, “Privacy-Aware Online Task Offloading for Mobile-Edge Computing,” *Wireless Communications and Mobile Computing*, vol. 2021, Article ID 6622947, 2021.
5. L. Gao, S. Chen, and M. Ding, “An improved DDPG-based privacy sensitive level protection computation offloading method in mobile edge computing,” *Future Generation Computer Systems*, vol. 158, pp. 112–124, 2024.
6. J. Xu, L. Chen, and P. Zhou, “Joint Service Caching and Task Offloading for Mobile Edge Computing in Dense Networks,” *IEEE Transactions on Mobile Computing*, vol. 22, no. 6, pp. 3254–3267, 2023.
7. J. Devlin, M. W. Chang, K. Lee, and K. Toutanova, “BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding,” *NAACL-HLT*, pp. 4171–4186, 2019.
8. N. Reimers and I. Gurevych, “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks,” *EMNLP*, pp. 3982–3992, 2019.
