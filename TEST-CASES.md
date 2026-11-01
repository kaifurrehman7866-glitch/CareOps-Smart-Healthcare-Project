# Test Cases

Executed with `npm test` against an isolated MongoDB instance. The six cases below passed.

| ID | Scenario | Expected result | Actual result |
|---|---|---|---|
| TC-01 | Seeded EVM and dashboard summary | PV = PKR 3,100,000; EV = PKR 2,990,000; AC = PKR 3,285,000; CPI = EV/AC; SPI = EV/PV; two unresolved critical defects | PASS. Seed calculation and both ratios matched; two critical defects counted. |
| TC-02 | Schedule work against a proposed requirement | Reject with HTTP 400; leave approved budget, deadline, and activity count unchanged | PASS. Proposed requirement was excluded; baseline and seven activities were unchanged. |
| TC-03 | Reject pending change | Record Rejected; preserve PKR 5,000,000 budget, 22 Dec 2026 deadline, and seven activities | PASS. Baseline values and activity count were unchanged. |
| TC-04 | Approve AI diagnosis + mobile request | Update budget to PKR 5,800,000 and deadline to 12 Jan 2027; approve the linked AI requirement, add the approved mobile requirement, WBS package, and scheduled activity | PASS. All linked baseline records were updated in one project-document save. |
| TC-05 | Add dependency-linked activity and enter actuals | Start after predecessor; 50% of PKR 120,000 adds PKR 60,000 EV; PKR 80,000 actuals add to AC | PASS. Successor dates and recalculated EV/AC matched. |
| TC-06 | Invalid risk plus defect and inspection updates | Reject likelihood 6; persist valid defect/checklist entries; allow defect resolution status update | PASS. Invalid request returned HTTP 400; valid records persisted and status changed. |

UI verification: the approval confirmation path was completed in the browser; desktop render was checked at 842 CSS px and mobile render at 280 CSS px. Both had no page-level horizontal overflow. The mobile size is the embedded-browser viewport, not a minimum supported device specification.

## Captured Screenshots

- `screenshots/overview-desktop.png` - dashboard at desktop size.
- `screenshots/overview-mobile.png` - responsive dashboard at phone size.
- `screenshots/scope-pending.png` - AI remains proposed and the PKR 5M baseline is pending review.
- `screenshots/scope-approved.png` - AI and mobile requirements approved with updated baseline.
- `screenshots/project-charter.png` - project charter, delivery team, milestones, and closure record.
- `screenshots/schedule-evm.png` - dependency-based schedule, forecast, and EVM entry.
- `screenshots/quality-risk.png` - seeded critical defect, checklist, risk matrix, and PDPC response view.