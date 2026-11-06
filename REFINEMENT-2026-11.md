# Bathhouse Mahjong refinement, November 2026

**User-directed early closure. Formal release HOLD.**

The user directed testing to end. This report retains the original scoped observations and their limitations. The formal campaign record remains BASE, QUEUED, loop 0. Full qualification, production deployment and production smoke remain unverified. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Source and publication

The fix history integrated into `main` contains `51ba24494811e7199122724bd056be0dec20f88d`. The fix already includes the tracked `index.html`. Its SHA-256 is `640c92ef2d15a98c33d0454d0d7068a0a0f018225a7ed88a67bbeb6648c59470`. No tests were run during this integration.


The historical publication inventory records `v2.2.0` at commit `cd17a8ff7a6600ebfe38e4fb39540f906a226030`. The corresponding committed index SHA-256 was `033b5a840844ae1a05217d978e524b479bab2caeaced10f167638f94b5d8c959`. Current public response bytes and deployment identity still require verification. [Historical site ref inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-01-attempt1/stdout.txt>) · [Committed index inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-11-assessment/stdout.txt>)

- Local `refine/2026-11` at `51ba24494811e7199122724bd056be0dec20f88d` in `D:/hsg-campaign/worktrees/mahjong/desktop-refine-20261104`.

## Coverage matrix

The rows record bounded observations by workflow. Formal completion of each applicable workflow and profile is still pending. [Workflow and profile requirements](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)

| Workflow | Scoped evidence and remaining work |
| --- | --- |
| WF-01 Build and integrity | Historical preflight retained the exact committed index for the no-build game. Current candidate artifact, budgets and integrity gate remain pending. |
| WF-02 Feature inventory | Complete feature-to-real-input coverage map remains pending. |
| WF-03 Core loop | Completed Classic Pyramid with 72 actual UI Hint pairs, then observed result, retry, stats and reload. This was assisted play. |
| WF-04 Input | Physical iPad Safari exercised a real matching-pair removal and Pause and Resume in Classic Pyramid. |
| WF-05 Layout | A desktop title overflow was reproduced and the locally fixed title was reviewed. |
| WF-06 Mechanics | Independent full rules, seeded shadow models and balance comparisons remain pending. |
| WF-07 Persistence | Scoped save behavior is recorded where observed. Full shipped-format, failure-mode and rollback round trips remain pending. |
| WF-08 Audio | Full real-input audio, analyser and recovery evidence remains pending. Human audibility remains unverified. |
| WF-09 Lifecycle | Full lifecycle matrix remains pending. Individual actions are listed in the retained scoped evidence. |
| WF-10 Performance | Hardware-qualified frame cost, throttled load and 30-minute soak remain pending. |
| WF-11 Accessibility | Full keyboard, contrast, scalable text and assistive checks remain pending. |
| WF-12 Content and licensing | Complete help, site controls, claims and licensing audit remains pending. |
| WF-13 Player integration | Scoped local player paths were observed in Chrome and Edge. Current formal workflow, exact production routes and candidate smoke remain pending. |
| WF-14 Visual polish | A desktop title overflow was reproduced and the locally fixed title was reviewed. |

## Defect log

| Severity | Recorded defect or finding | Integration status |
| --- | --- | --- |
| S3 | Title overflowed panel | Integrated source fix `51ba24494811e7199122724bd056be0dec20f88d`. Included in the repository integration. Production deployment remains unverified. |

The integrated changes affect play as follows. The title fits the tested desktop panel. [Local commit and worktree index](<D:/hsg-campaign/platform-support/release-controller/final-report-readiness-031009b8-9c99-4849-87ee-76e539afcebb/REPORT-READINESS.json>)

## Before and after

The selected original desktop run recorded 49 passes and 3 failures. One failure involved the software-renderer premise and two involved picking-oracle coordinates. A separate explicit software fallback passed. The local title fix does not supersede those original outcomes. [Evidence 1 · 9226](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-mahjong-final-handoff-b1e317e1-52dd-4706-ab74-fad39d68ba3b/handoff.json>)

## Evidence tiers

- Installed Chrome and Edge basic player observations are scoped E2 desktop evidence. Hardware qualification and broader workflow coverage remain separate. [Desktop scope and profile limits](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)
- The physical iPad Safari lane records 1 completed bounded gameplay run across 1 attempt. The R8 local route returned 200 with body SHA-256 `640c92ef2d15a98c33d0454d0d7068a0a0f018225a7ed88a67bbeb6648c59470`. The last gameplay body SHA-256 was `640c92ef2d15a98c33d0454d0d7068a0a0f018225a7ed88a67bbeb6648c59470` from source commit `51ba24494811e7199122724bd056be0dec20f88d`. Physical iPad scope is recorded separately from the Android and WebKit proxy tiers. [Physical iPad route](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-route-verification-r8-9157fa31-c2c2-46ee-a788-e9bb70e3a59e/route-report.json>) · [Physical iPad gameplay](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-final-report-c14434a9-3a6e-49f6-83fa-a1bea341c260/FINAL-REPORT.json>)

## Pending coverage and limitations

- 49 selected original cases passed and 3 failed, including a renderer premise and two picking-oracle failures. Separate software fallback passed. Natural Classic Pyramid used UI hints.
- Full A1 and A2 Android Chrome workflow evidence, the complete device and mode matrix, all historical save/rollback paths, independent rounds and production smoke remain pending. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Not Covered

No approved exclusions. Pending work is listed above.

## Manual checklist candidates

- Real iPhone Safari, Android handset performance and heat, and audible-output review remain for the end-of-campaign manual checklist. [Manual-checklist requirement](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)
