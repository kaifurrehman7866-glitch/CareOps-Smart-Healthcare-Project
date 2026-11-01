# CareOps | Smart Healthcare Project Control

A full-stack MERN project management and monitoring system built around the five-hospital healthcare case study. It includes a React control-room UI, Express REST API, and MongoDB persistence.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. On the first run, `mongodb-memory-server` downloads the MongoDB server binary if needed. With no `MONGODB_URI`, the API starts a local MongoDB process and stores its database under `data/careops-mongodb/`; it does not require a separately installed MongoDB service. To use an existing MongoDB server, set `MONGODB_URI` before starting, for example:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/healthcare_project'
npm run dev
```

The Express API listens on port 5000. Vite serves the UI on port 5173 and proxies `/api` requests to Express. Sample project data is created automatically when the database is empty. To reset the local demo, stop the app and remove `data/careops-mongodb/`; the next start recreates the seed.

## Included workflows

- Project charter and management plan: objective, stakeholders, scope boundaries, approved budget, dates, team, milestones, and a closure record.
- Requirements register: priorities, proposals, approval/rejection, and protection against scheduling work against an unapproved requirement.
- Hierarchical WBS and controlled change requests with cost, schedule, justification, approval, and rejection.
- Dependency-based weekday schedule, delayed-task and forecast-finish calculations, milestones, resource assignments, and progress/actual cost updates.
- Earned value: PV, EV, AC, CPI, SPI, budget variance, and warning thresholds at CPI/SPI 0.90 and approved-budget overrun.
- Quality checklist, defect status/severity/owner tracking, likelihood-impact matrix, and a PDPC-style risk response register.
- Dashboard highlighting pending changes, forecast finish, schedule delay, budget performance, and unresolved critical defects.

## Demonstrate the case study

The initial project is seeded with the PKR 5,000,000 / 16-week baseline; seven team members; five approved healthcare requirements; a proposed AI diagnosis requirement; sample WBS and dependency-linked activities; earned-value actuals; the pending AI + mobile request with PKR 800,000 / three-week impact; and critical appointment and patient-record defects.

1. Open **Overview** to review PV / EV / AC, CPI / SPI, forecast schedule, pending change, and release blockers.
2. Open **Scope & changes**. Verify the AI requirement is proposed and the baseline remains PKR 5,000,000 with a 22 Dec 2026 deadline.
3. Approve the pending **AI preliminary diagnosis and mobile application** change. Confirm the AI requirement moves from Proposed to Approved, a separate mobile-app requirement is added, and the project baseline becomes PKR 5,800,000 with a 12 Jan 2027 deadline. A WBS package and activity are added; the activity depends on the current terminal work.
4. Open **Schedule & EVM** to update task progress/actuals and inspect the recalculated indices and schedule.
5. Open **Quality & risk** to resolve the two seeded critical defects, record inspection outcomes, and review risk responses.

The approval action is confirmed in the UI and saved as one Mongoose project-document update so scope, budget, deadline, WBS, activity, and change status stay together.

## Database design

The MongoDB `Project` document is the aggregate root. Embedded arrays persist requirements, WBS packages, activities and dependency ObjectIds, change requests, defects, inspections, risks, and milestones alongside the charter. This keeps approval and related baseline updates in one document write. The API validates references and enumerated values and reports validation/optimistic-concurrency failures without exposing server internals.

To inspect the schema and seed data, see `server/index.js`. The default demo DB files are local-only and ignored by Git.

## Tests and production build

```powershell
npm test
npm run build
```

Tests use an isolated in-memory MongoDB database and cover EVM calculations, proposal boundaries, approval/rejection baseline effects, dependency scheduling, input validation, defects, and quality records.

## Submission evidence

Captured dashboard screenshots for desktop and mobile, scope/change-control before and after approval, and the quality/risk page are in `screenshots/`. `TEST-CASES.md` lists the expected and verified outcomes for the backend scenarios. Capture the Project charter and Schedule & EVM pages from the running app as additional presentation views.