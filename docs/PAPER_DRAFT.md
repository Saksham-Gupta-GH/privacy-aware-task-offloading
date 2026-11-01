# PrivacyDrive: Privacy-Aware Task Offloading for Mobile Edge Computing

> Author names, registration numbers, institution, and faculty guide: **add before submission**.

## Abstract

Mobile edge computing allows resource-constrained clients to execute tasks locally,
at a nearby edge server, or in a remote cloud. Conventional placement based only on
latency or energy can expose sensitive input. We present PrivacyDrive, a three-tier
document-processing prototype that treats privacy as a hard placement constraint and
then minimizes a weighted latency–client-energy score subject to worker availability
and an optional deadline. A local explainable classifier assigns public, personal,
restricted, or uncertain sensitivity. Public tasks may use all tiers, personal tasks
may use local or a trusted edge, and restricted or uncertain tasks remain local. The
common workload is semantic text embedding, enabling a visible local smart-search
feature. The implementation uses a React dashboard, FastAPI orchestration, identical
pinned ONNX workers, local SQLite storage, a physical Windows edge laptop, and an
Azure student VM. On 11 labelled synthetic cases, the classifier produced 11 correct
labels with an 18.2% conservative uncertain rate. The physical M1 client was faster
than the idle Ryzen edge for every tested workload, an important negative result. A
memory-safe Azure configuration processed 32 passages in a median 3.913 s end to end
and 128 passages in 15.441 s. Across five demo documents in a calibrated client-busy
scenario, the proposed policy produced zero violations; always-cloud and latency-only
baselines produced three and two, respectively. The prototype shows that privacy-aware
placement can preserve explicit
data-location rules while still adapting to availability and resource pressure.

**Keywords:** mobile edge computing, computation offloading, privacy classification,
latency, energy, semantic search

## 1. Introduction

Multi-access edge computing places cloud-like resources close to users and is intended
to support low-latency, high-bandwidth services [1]. A mobile task can therefore run on
the client, a nearby edge, or a remote cloud. The choice affects response time, client
energy, and load. It also affects who receives the input. A payment document sent to an
untrusted cloud is a policy failure even if it returns quickly.

PrivacyDrive explores the question: **how should a client place a task when privacy is
non-negotiable but latency, energy, and resource availability still matter?** Its main
contribution is an understandable implementation in which privacy filters candidates
before numerical optimization. This differs from treating privacy as only another
weighted term that can be traded away.

The prototype makes four contributions:

1. local, explainable, versioned content classification with a conservative fallback;
2. hard per-class placement permissions for local, trusted-edge, and cloud execution;
3. an availability-, deadline-, latency-, and client-energy-aware optimizer with visible
   explanations and execution receipts; and
4. a reproducible physical prototype and honest evaluation, including cases where
   offloading does not improve idle latency.

## 2. Related work

ETSI describes MEC as cloud-computing capability and an IT service environment at the
network edge [1]. Prior offloading research commonly optimizes a weighted latency and
energy objective [2] or jointly allocates computation and communication resources [3].
Privacy-aware online offloading has modeled privacy and system cost jointly [4], while
recent three-tier work uses learned privacy-sensitive levels and reinforcement learning
[5]. Location-specific work also demonstrates that offloading metadata can itself
create privacy risks [6].

PrivacyDrive is smaller in algorithmic scope than these learning-based systems. Its
focus is a demonstrable hard-policy architecture: local inspection, explicit tier
permissions, identical real workers, local indexing, and per-decision evidence. It does
not claim differential privacy or protection from a compromised edge.

## 3. System and threat model

For task \(i\), the candidate tier is \(j \in \{L,E,C\}\): local client, trusted edge,
or cloud. Each worker reports availability, readiness, and queue depth. The client
stores raw documents, classifications, embeddings, queries, and history locally.
Remote workers receive only tasks permitted by policy and keep no application-level
persistent copy.

The classifier produces sensitivity \(s_i\):

- public: \(A_i=\{L,E,C\}\);
- personal: \(A_i=\{L,E\}\);
- restricted: \(A_i=\{L\}\); and
- uncertain: \(A_i=\{L\}\), with manual review recommended.

The model protects raw personal/restricted content from the untrusted cloud. It assumes
the client and declared edge are trusted. It does not prevent a compromised endpoint,
traffic-analysis from sizes/timing, model inversion from embeddings, or classifier
error. Search embeddings remain local because embeddings may reveal source semantics.

## 4. Classification and placement method

### 4.1 Local classification

The rules inspect readable text for contextual combinations rather than filenames. For
example, a card-like number becomes restricted only with payment context; an order
number is a hard negative. Health information becomes restricted when linked to an
identity signal. Explicit confidentiality markers also produce restricted status.
Detected evidence is masked in the UI. The most restrictive signal wins, and ambiguous
content becomes uncertain rather than being sent remotely.

### 4.2 Cost model

Local latency is processing plus queue time:

\[
T_{i,L}=T^{proc}_{i,L}+T^{queue}_{i,L}.
\]

Remote latency includes round-trip, upload, processing, queue, and result download:

\[
T_{i,j}=RTT_j+T^{up}_{i,j}+T^{proc}_{i,j}+T^{queue}_{i,j}+T^{down}_{i,j}.
\]

Estimated client energy is:

\[
E_{i,L}=P^{cpu}T^{proc}_{i,L}
\]

and for remote execution:

\[
E_{i,j}=P^{tx}T^{up}_{i,j}+P^{idle}(T^{proc}_{i,j}+T^{queue}_{i,j})
       +P^{rx}T^{down}_{i,j}.
\]

Energy is explicitly reported as model-estimated, not hardware-metered. Power values
are versioned calibration inputs and should be varied in sensitivity analysis.

### 4.3 Optimizer

For latency preference \(\alpha\in[0,1]\), normalized cost is:

\[
J_{i,j}=\alpha\frac{T_{i,j}}{T_{ref}}+(1-\alpha)\frac{E_{i,j}}{E_{ref}}.
\]

The scheduler first removes tiers not in \(A_i\), offline/not-ready workers, and tiers
predicted to miss a deadline. It then selects the feasible tier with minimum \(J\). If
the feasible set is empty, it defers the task instead of weakening privacy.

## 5. Implementation

The React/TypeScript dashboard resembles a document workspace. A user adds text,
reviews the local privacy decision, adjusts the latency–energy slider, chooses a live or
clearly labelled simulated resource scenario, and requests processing. Three candidate
cards show permissions, availability, predictions, and reasons. FastAPI performs local
classification and orchestration. SQLite stores source text and the search index on the
client. Every tier uses the same pinned `all-MiniLM-L6-v2` ONNX model revision with
mask-aware mean pooling, L2 normalization, and 384-dimensional float32 output.

The edge and cloud APIs bind to loopback and are carried through SSH tunnels. A receipt
records task ID, worker identity, tier, measured worker processing time, passage count,
model revision, dimensions, and output digest. Mixed inputs become per-document tasks,
so a batch can be split without letting a public majority override a restricted file.

## 6. Evaluation

### 6.1 Setup

The local stand-in is an Apple M1 MacBook Air. The trusted edge is an AMD Ryzen 5 5500U
Windows laptop with 8 GB RAM. The cloud is an Azure Standard_B2ats_v2 student VM with
two burstable vCPUs and 1 GiB RAM. Workloads and seeds are fixed in the repository. All
documents are synthetic. Repeated timing uses warm-up runs and reports medians.

### 6.2 Classifier

The labelled set contains public content, public contact information, personal contact
data, payment formats, confidential and health content, card-like hard negatives, an
order-ID hard negative, mixed content, and empty input. All 11 expected labels matched;
two cases (18.2%) deliberately used uncertain/local-only. This small synthetic result
validates the implemented rules, not general real-world classifier accuracy.

### 6.3 Physical workload results

With the PyTorch reference workload, M1 medians for 1, 32, and 512 passages were 18.506
ms, 441.005 ms, and 7,343.942 ms. Edge medians were 42.488 ms, 1,076.319 ms, and
17,614.587 ms. Thus the idle edge was 2.30–2.44 times slower. Cross-platform output
cosine similarity was 1.0000000000, with maximum component difference about
\(7.45\times10^{-8}\). Restricting the M1 to one inference thread still did not create
a crossover. We therefore use declared busy/queued scenarios rather than artificially
slowing the client until the desired result appears.

### 6.4 Azure resource adaptation

An initial PyTorch cloud runtime could not coexist reliably with other services. ONNX
reduced the footprint, but a 32-passage inference batch still triggered an out-of-memory
restart. Setting the production inference batch to one retained the same model and
outputs while bounding peak memory. Median worker/end-to-end times were 76.286/518.674
ms for 1 passage, 2,389.966/3,912.631 ms for 32, and
9,564.676/15,441.439 ms for 128. This demonstrates why resource state belongs in the
placement decision.

### 6.5 Baselines

Across the five seeded demo documents under calibration v2, the privacy-aware method
has zero policy violations. Always-local also has zero but cannot exploit permitted
remote capacity. Under the explicitly simulated client-busy queue scenario,
always-cloud violates policy for three documents and latency-only for two. These are
calibrated simulations; worker receipts separately show measured live execution. A
public document was routed end to end to the real Azure worker, while a payment-card
test document remained local under the same client-busy condition.

### 6.6 Trade-off and sensitivity analysis

In an all-ready live scenario, \(\alpha=0\) through \(0.75\) selected the edge for the
three public/personal documents and local for the two restricted documents, averaging
1,061.536 ms and 1.4711 J. At \(\alpha=1\) (latency only), all five selected local,
reducing predicted latency to 918.800 ms but increasing estimated client energy to
2.2970 J. Scaling every client power parameter by -30% and +30% at \(\alpha=0.65\)
changed average energy from 1.0298 J to 1.9125 J but did not change placement or policy
compliance. Thus the selected tiers are stable for this range, while the numeric energy
claim remains sensitive to the assumed power values. Raw results are published in
`validation/results/scheduler-experiments.json`.

## 7. Limitations and future work

The rules and test corpus are small, English-only, and text-only. The energy model uses
published-style power components but is not directly meter-validated. The trusted-edge
assumption is strong. Simulated busy scenarios model queue delay rather than generating
background load. Future work should add a larger independently labelled corpus,
calibrated mobile power measurement, authentication between components, encrypted
local storage, metadata minimization, edge attestation, and experiments with concurrent
arrivals. Differential privacy or trusted execution could protect information beyond
the present hard location policy.

## 8. Conclusion

PrivacyDrive demonstrates that task offloading need not choose between an understandable
privacy rule and a measurable systems objective. By filtering destinations first and
optimizing only among allowed, available, deadline-feasible tiers, the system preserves
data-location policy under changing load. Its physical results also show the importance
of honest evaluation: local execution can be fastest, a small cloud can be constrained,
and offloading value depends on current resources rather than tier names.

## References

1. ETSI, “Multi-access Edge Computing,” official technology overview and standards hub. https://www.etsi.org/technical-groups/mec/?id=1806
2. H. Zhang et al., “Energy-Latency Tradeoff for Energy-Aware Offloading in Mobile Edge Computing Networks,” *IEEE Internet of Things Journal*, 2018. DOI: 10.1109/JIOT.2017.2786343.
3. “Joint Task Offloading and Resource Allocation for Energy-Constrained Mobile Edge Computing,” *IEEE Transactions on Mobile Computing*, 2023. DOI: 10.1109/TMC.2022.3150432.
4. X. Zhu et al., “Privacy-Aware Online Task Offloading for Mobile-Edge Computing,” *Wireless Communications and Mobile Computing*, 2021. DOI: 10.1155/2021/6622947.
5. “An improved DDPG-based privacy sensitive level protection computation offloading method in mobile edge computing,” *Future Generation Computer Systems*, 2024. DOI: 10.1016/j.future.2024.05.018.
6. “Location Privacy-Aware Task Offloading in Mobile Edge Computing,” *IEEE Transactions on Mobile Computing*, 2024. DOI: 10.1109/TMC.2023.3254553.
