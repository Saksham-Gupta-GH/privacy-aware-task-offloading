# PrivacyDrive presentation script (6–8 minutes)

## Slide 1 — Problem (40 seconds)

“A mobile task can run on the phone, a nearby edge, or the cloud. The fastest choice
may expose private input. Our project first enforces privacy and then optimizes latency,
estimated client energy, resource availability, and deadlines.”

## Slide 2 — Architecture (45 seconds)

Show the three-tier diagram from the README. Explain that classification, raw storage,
embeddings, and search queries remain on the client. Edge is trusted by assumption;
cloud is not trusted for personal or restricted source text.

## Slide 3 — Policy and optimizer (60 seconds)

Show the four policy rows. Say: “Privacy is a hard constraint, not just a slider. A
restricted file cannot go to cloud even when cloud looks faster. The slider only chooses
between already-permitted destinations.” Explain availability and deadline filtering.

## Live demo (3–4 minutes)

1. Open `public_event.txt`. Point out Public → Local/Edge/Cloud.
2. Select “Simulated: client + edge busy,” actual workload, and process. Show the real
   Azure receipt: worker `azure-student-vm`, tier, model revision, and measured time.
3. Open `restricted_payment.txt`. Keep the same scenario and move the slider fully to
   latency. Process it. Point out that edge/cloud remain blocked and execution is local.
4. Open `personal_contacts.txt`. When the edge laptop is connected, show Cloud blocked
   and Edge permitted. If edge is offline, use that state to explain availability.
5. Search for “university technology event.” Point out that query and index location
   both say local.
6. Open Experiments. Compare zero proposed violations with always-cloud and latency-only.

## Slide 5 — Results (60 seconds)

- Classifier: 11/11 on the declared synthetic rule test set; 18.2% uncertain rate.
- Idle M1 beat the edge in every workload; do not hide this result.
- Azure 1 GiB VM required streaming batch size 1 after a larger batch caused an OOM
  restart. Medium median end-to-end: 3.913 s; heavy: 15.441 s.
- Proposed method: zero policy violations on five demo documents.

## Slide 6 — Limitations and conclusion (45 seconds)

“This is a research prototype, not a production DLP product. The classifier is rules-only
and text-only, energy is estimated, and the edge is trusted. The contribution is the
complete and visible decision pipeline: local classification, hard privacy policy,
resource-aware optimization, real execution, and an auditable receipt.”

## Likely questions

**Is it just a sensitive-file detector?**  No. Classification determines the feasible
set; the research task is choosing local/edge/cloud using privacy, latency, energy,
availability, load, and deadlines.

**Why offload if the Mac is faster?**  Offloading is conditional, not universal. A busy
or battery-sensitive client may benefit from permitted remote capacity. Our idle result
honestly shows local is best on this hardware.

**Why use simulated busy states?**  They provide repeatable queue conditions. They are
labelled simulated; actual worker execution and receipts remain real.

**What if no tier meets the deadline?**  The task is deferred. Privacy is never relaxed.

**Does Azure store the file?**  The worker is stateless at the application level. It
receives only a policy-permitted task, returns vectors, and the local client stores the
index.
