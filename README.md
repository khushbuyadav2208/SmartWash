# SmartWash — Campus Laundry Management

SmartWash continues the existing React/Vite and Express project. It provides student bookings and tracking, staff garment verification/processing/delivery, and administrator operations. MongoDB is now mandatory; the server never uses JSON as a runtime database.

The single progress and verification record is [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md). Screenshots in the original download show the earlier UI; browser captures are excluded from this source deliverable.

## Requirements

- Node.js 22.12 or newer (Node 24 used for verification), npm.
- MongoDB Community Server 7+ configured as a replica set, or an Atlas deployment.
- MongoDB Compass is optional. `mongosh` is needed to initialize a local replica set.
- HTTPS in production; camera access requires HTTPS or localhost.
- SMTP is optional for email verification and password reset.

Atomic transactions keep accounts/profiles, orders/scans, capacity, notifications and audit events consistent. A standalone MongoDB instance is deliberately rejected. There are no hardcoded production accounts or automatic seeds.


## Upgrade an existing installation (your current setup)

Your MongoDB `rs0` and administrator already exist. **Keep your existing `backend/.env`, database directory and accounts. Do not rerun `rs.initiate()`, administrator bootstrap, migration or any cleanup to install this upgrade.** The deliverable intentionally excludes secrets and installed dependencies. Copy the source over the existing project while keeping `.env`; the source includes `.env.example` only for fresh installations. This run did not connect to or change your Windows database.

Open PowerShell in the actual `Smart_Wash-main` folder (the archive may have a wrapper folder). Install dependencies:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

First PowerShell window:

```powershell
Set-Location .\backend
npm run dev
```

Second PowerShell window, starting again in `Smart_Wash-main`:

```powershell
Set-Location .\frontend
npm run dev -- --host localhost --port 5173 --strictPort
```

Open the exact origin in `APP_ORIGIN`, normally `http://localhost:5173`. Select **Admin Portal**, **Student Portal** or **Staff Portal**, or open `/admin`, `/student`, `/staff` directly. Log in with your existing administrator credentials; no default admin password is supplied. Students register through Student Portal → Create account. Administrators provision staff in Staff Accounts; staff use their assigned email/password. A selected portal rejects accounts belonging to another role. Authenticated users are redirected to their authorized portal, including after refresh.

Check readiness from PowerShell: `Invoke-RestMethod http://localhost:5000/api/health`. For existing MongoDB, `mongosh` → `rs.status()` is a read-only readiness check; wait for PRIMARY and keep the existing URI. Compass connects using exactly that URI. `backend/.env` is now resolved beside the server module, independent of the terminal's working directory, without overriding environment variables.

## Fresh installation only

1. Install MongoDB Community Server from [MongoDB's installation instructions](https://www.mongodb.com/docs/manual/installation/). On Windows, the MSI can install a service; install Compass and mongosh separately if needed. On Linux/macOS, follow the instructions for your OS.
2. Configure a local development replica set. For a fresh local database, create an empty directory such as `C:\mongo-smartwash` on Windows or `~/mongo-smartwash` on macOS/Linux. Do not reuse or remove a directory containing existing data.
3. Start MongoDB in a terminal:

   ```sh
   mongod --dbpath /absolute/path/to/mongo-smartwash --replSet rs0 --bind_ip 127.0.0.1 --port 27017
   ```

   Windows PowerShell example (adjust the installed version path):

   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\mongo-smartwash" --replSet rs0 --bind_ip 127.0.0.1 --port 27017
   ```

   If using the installed Windows service instead, edit its `mongod.cfg` to add `replication: { replSetName: rs0 }` and restart the service. Do not start a second process on the same port.
4. In another terminal, connect with `mongosh "mongodb://127.0.0.1:27017/?directConnection=true"` and initialize this **new** replica set once:

   ```js
   rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })
   rs.status()
   ```

   Wait for PRIMARY. Existing replica sets do not need initialization or reconfiguration.
5. From the project root, install the locked dependencies:

   ```sh
   npm ci --prefix backend
   npm ci --prefix frontend
   ```
6. For a **new installation without an existing .env**, copy `backend/.env.example` to `backend/.env`. Set:

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27017/smart_wash?replicaSet=rs0
   APP_ORIGIN=http://localhost:5173
   PORT=5000
   NODE_ENV=development
   LAUNDRY_TIMEZONE=Asia/Kolkata
   SESSION_HOURS=12
   ```

   On PowerShell: `if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }`. On macOS/Linux: `cp backend/.env.example backend/.env`.
7. Create an administrator explicitly. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optional `ADMIN_NAME` in your local `.env`. The password needs at least 12 characters, uppercase, lowercase and a number, and must fit within bcrypt's 72-byte limit.

   ```sh
   cd backend
   npm run bootstrap
   ```

   Configure real hostels in the administrator portal. Optional development samples use the guarded `--demo` mode described below, independently of administrator creation. Bootstrap never overwrites an existing account and fails if the email exists. Remove the bootstrap password from `.env` after use.
8. Start the backend from `backend/`: `npm run dev` (or `npm start`). In another terminal, start the frontend from `frontend/`: `npm run dev`. Open **http://localhost:5173**. Use the hostname matching APP_ORIGIN; `127.0.0.1` and `localhost` are different origins.
9. Sign in as your administrator. Configure hostels, rooms, schedules and staff. Students use **Create account**, choose their hostel/room, and receive unique garment tags.

## MongoDB Compass

Connect Compass with the same `MONGODB_URI` used by the backend. For the example above, paste `mongodb://127.0.0.1:27017/smart_wash?replicaSet=rs0` into New Connection. The `smart_wash` database contains users, students, hostels, schedules, orders, issues, notifications, scanevents, audits, sessions and authtokens. User credentials are bcrypt hashes; sessions and reset/verification tokens are SHA-256 hashes. Never share Compass screenshots containing private data or connection credentials.

For Atlas, create a database user, configure network access, and use its supplied `mongodb+srv://...` connection string in your local `.env` and Compass. Encode special characters in database credentials. Use a scoped database account and production backup policy.

## Preserving and migrating legacy data

`backend/data/db.json` is retained as **migration input only**. Its plaintext password fields in the supplied download have been replaced with bcrypt hashes in this deliverable; identifiers and operational records are preserved. The original uploaded ZIP is the untouched source. The migration accepts either original plaintext passwords (hashing them before insertion) or pre-hashed input.

**This particular dataset fails validation**, intentionally preventing unsafe import:

- Order `r2` references six tag serials (`T00021` through `T00026`) that do not appear on the referenced student's tag list.
- Students `s3`, `s4`, `s5` have hostel/room assignments inconsistent with the supplied hostel/room inventory.

These require an operator to verify the intended tags and room assignments. Do not invent replacements or delete historical records to make import succeed. No existing database was migrated during this upgrade.

From `backend/`:

```sh
npm run migrate
npm run migrate -- --source=/absolute/path/to/verified-db.json
```

Default is a dry-run: it validates records, references, duplicate IDs/emails/tags and active orders without connecting to or modifying MongoDB. After correcting a **copy** of the source with verified information, review the dry-run output and obtain the data owner's approval before committing:

```sh
npm run migrate -- --source=/absolute/path/to/verified-db.json --commit
```

Commit requires MongoDB and creates protected `backend/backups/` files: a verified source copy and a snapshot of the existing target entity collections. Inserts occur in a transaction. Existing IDs are reported as skipped; identity conflicts and unique-index conflicts abort the transaction. It never replaces existing records, deletes collections or resets a database. Backups contain private data; protect them and retain your regular MongoDB backup as well. A migration is not a database restore tool.

## Authentication and security

- Public signup always creates a student, regardless of submitted role fields. Administrative and staff provisioning require an authenticated administrator.
- Passwords use bcrypt with cost 12. Responses omit password hashes. No token or user credentials are stored in browser localStorage.
- Revocable random sessions use HttpOnly, SameSite=Lax cookies; production adds Secure. Sessions expire after the configured duration. Logout revokes the server session; password reset or authenticated Account security → Change password revokes every session for that user. Password changes require the current password. Saving staff assignments or credentials also revokes their sessions.
- APIs enforce role, student ownership and staff hostel assignment. Deactivated accounts are blocked. Archived staff accounts lose sessions; records are retained for audit.
- Helmet headers, bounded JSON bodies, same-origin mutation checks, authentication rate limits and general API rate limits are configured.
- Staff can process their assigned hostel, report incidents and resolve complaints assigned to them. Admins can manage all hostels.
- Readiness is `GET /api/health`. Missing URI, inaccessible MongoDB or a standalone instance prevents server startup. Database failures return errors, never fake success.

## Email verification and password reset

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `APP_ORIGIN`. Port 465 uses implicit TLS; 587 uses STARTTLS. Configure real provider credentials locally; do not commit them.

With SMTP configured, public signup requires email verification before login. Links use expiring, hashed, single-use tokens. Reset links expire in 30 minutes; verification links expire in 24 hours. **Resend verification** allows retrying delivery. Existing imported accounts and explicitly provisioned staff/admins are marked verified.

Without SMTP, students can register and sign in; Forgot Password returns a clear configuration error. No reset token is returned by the API or printed in logs. Actual email-provider delivery requires verification with your provider and has not been tested here.

## Working portals

**Student:** book up to 20 garments for today or a pickup date within 30 days, track the lifecycle and configured ETA, view/filter history and printable fee statements, acknowledge verified collection, report incidents, view/edit name/mobile, name/category existing garments and print active QR labels, cancel before receiving, read notifications. Order tracking refreshes every 30 seconds. Hostel/room reassignment is administrator-controlled.

**Staff:** search/filter the assigned hostel queue, identify an order via laundry card, verify one active label per garment, record weight, advance processing in order, scan a recorded garment label for delivery, report discrepancies, resolve assigned complaints and view their timestamped operational activity. Camera scanning uses ZXing; manual payload entry works independently. There is a separate delivery-scanning mode. Duplicate scans keep the verified count unchanged. Invalid, inactive, foreign or excess tags are rejected.

**Administrator:** real dashboard counts/charts and filtered status analytics; hostel creation/edit/archive/reactivation, building/floor/room inventory and optional room capacity; student creation/name/mobile/identity/hostel/room editing and activation; staff creation/assignment/edit/deactivation/reactivation and credential updates; secure tag replacement/disable; schedule days, capacity, processing-time estimate and weight pricing; order search/date/hostel/status monitoring; complaint assignment and resolution; announcements and audit history.

Lifecycle: Waiting for Verification → Received → Washing → Drying → Ready → Delivered. Cancellation is allowed only before receiving. Incidents are retained separately and flag the order; unresolved incidents block delivery. The operational vocabulary does not introduce a separate exception status that would obscure the underlying processing stage.

Unique garment serials are associated with a student and may have a garment name/category. Existing anonymous garment labels remain valid. Changes to labels attached to an active order are blocked; replacement copies the descriptors while revoking the old serial. Pickup and delivery metadata record the authorized actor/station/time. Students can acknowledge a verified delivery once; replay keeps the original acknowledgement. Events record the authorized actor, desk/station, order and timestamp. Receipt of an order requires exact declared/verified count and positive measured weight. Delivery requires an active tag already received on that order. Lost/damaged tags cannot be reactivated; a tag in an active order cannot be silently replaced.

## Scheduling, ETA and billing

Pickup capacity is reserved transactionally per hostel/date; cancelled orders release their reservation. Delivered orders still count toward that day's capacity. The booking form retrieves the next 31 date options, eligibility and remaining places from the backend; final capacity is rechecked transactionally. Pickup and delivery configuration currently uses a same-day window, with delivery later than pickup. Scheduling uses LAUNDRY_TIMEZONE, default Asia/Kolkata. Administrator analytics date boundaries are explicitly UTC.

ETA begins at verified receipt and uses the hostel's configured processing hours. It is a **rule-based estimate**, not an ML prediction or a guaranteed completion time. Staff and admin views expose overdue counts/indicators. No forecasting is advertised.

The backend computes `max(0, measuredWeight − weightLimit) × extraRate`, rounded to two decimals. It saves an immutable fee statement and pricing terms on the order; clients cannot override the charge. Displays are charge statements, **not paid receipts**. Payment collection, gateways and tax invoicing are outside the current implementation.

## Optional development demo records

The existing `bootstrap.js` handles both administrator creation and separate demo modes. **`--demo` never creates or updates an admin.** Demo data is opt-in, prohibited when NODE_ENV=production, and requires `DEMO_DATA_ENABLED=true` plus acknowledgement of the exact target database name. Prefer a separate database such as `smart_wash_dev`; using the existing development database inserts only marked records, without modifying its real records.

From `backend/` in PowerShell, with a development database URI already configured:

```powershell
$env:NODE_ENV = 'development'
$env:DEMO_DATA_ENABLED = 'true'
$demoSecret = Read-Host 'Choose a strong demo password' -AsSecureString
$env:DEMO_PASSWORD = [System.Net.NetworkCredential]::new('', $demoSecret).Password
npm run bootstrap -- --demo --database=smart_wash_dev
Remove-Item Env:DEMO_PASSWORD
```

Use the database name from your URI instead of `smart_wash_dev`. The password must satisfy the same 12-character mixed-case/number policy. Never commit it. Demo accounts: `staff@smartwash.example`, `student1@smartwash.example` through `student4@smartwash.example`, with the password chosen on **first creation**. These reserved example addresses do not receive mail; demo accounts are explicitly verified. No preset production credentials exist.

Records carry `demoBatch=smartwash-demo-v1` and stable `sw-demo-*` identifiers: Development Demo Residence, D101–D104, daily schedule, one staff, four students, named QR tags, four orders in distinct lifecycle stages, a complaint, scan events, assessed fees, notifications and audits. The UI identifies demo accounts and management records. Repeat runs preserve all existing demo accounts/passwords and records. Identity conflicts with real records roll back the entire seed. The normal application remains usable without demo records; initial dashboards show real zero counts and empty states.

Cleanup is development-only and defaults to a dry-run:

```powershell
npm run bootstrap -- --cleanup-demo --database=smart_wash_dev
```

Review the counts. Obtain the data owner's explicit approval for deletion, stop the running backend to prevent concurrent changes, and then use the exact database/batch confirmation:

```powershell
npm run bootstrap -- --cleanup-demo --database=smart_wash_dev --commit --confirm=smart_wash_dev:smartwash-demo-v1 --backup-dir=./backups
```

Before deletion it writes a new restricted backup and verifies its SHA-256. Only marked demo records and sessions/tokens belonging to demo users are eligible. Real records referencing demo entities block cleanup, including new business/audit records generated while testing with demo users; review those records rather than bypassing the safeguard. It never resets the database, deletes collections or changes real credentials. Backups contain private account hashes; protect them. This upgrade **did not execute cleanup on your database**. Cleanup tests use disposable fixtures only.

## Record lists and compatibility

Growing students/staff/orders/issues/audit lists use bounded database queries (maximum 100 records per response). `?page=1&limit=20` returns `{items,page,limit,total,pages}`; `format=array` retains array compatibility with pagination headers. The existing portal adapter retrieves all pages for its current client-side search/filter views, and tables render ten rows per page. Staff activity uses direct server pagination. This is suitable for campus workloads; very large deployments should move each portal filter to server queries rather than preload lists. The first-party UI does not silently drop records at the API page boundary.

Optional `Hostel.roomDetails` stores building, floor and capacity while retaining the existing `rooms` inventory for compatibility. Legacy rooms have no inferred capacity; administrators set it explicitly. Active assignment counts enforce a configured capacity and room removal is blocked while any student references it. Archive preserves historical references; reactivate through Edit details. Sparse unique normalized hostel/roll keys protect new/edited records without rewriting existing profiles. Existing duplicate names/rolls require operator review if later editing collides.

## Verification

From the root:

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Backend tests launch a disposable real MongoDB replica set using mongodb-memory-server, and never connect to MONGODB_URI. Initial test execution downloads MongoDB 7.0.24 and needs network access. API tests cover signup/hash persistence, duplicates, invalid credentials, cookies, permissions/isolation, orders, concurrency/capacity, lifecycle, QR events/replay/invalid tags, complaints, notifications/audit/analytics, reset and logout, role-specific entry, room inventory/capacity, mapping, staff reactivation, garment descriptors, fee statements, delivery acknowledgement, demo idempotence/cleanup and persistence across a real backend process restart.

Install the browser once before end-to-end tests:

```sh
cd frontend
npx playwright install chromium
cd ..
npm run test:e2e
```

The end-to-end runner creates a disposable MongoDB database and temporary admin/staff fixtures, starts the API and Vite, then runs actual browser interactions. Ports 5000 and 5173 must be free. Do not run this alongside your local app. Browser screenshots/test output are temporary artifacts, excluded from the deliverable. `backend/test_api.js` redirects the former test entry point to the isolated suite; it no longer mutates a running operator database.

For exact results and remaining limits see the single implementation checklist. Physical camera/hardware scanning and SMTP delivery require checks on your device/provider.

## Production

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm run build
```

Set `NODE_ENV=production`, a valid `MONGODB_URI`, and `APP_ORIGIN=https://your-domain.example` in the hosting environment. Start with `npm start`; Express serves the frontend build and `/api` on the same origin. Configure HTTPS at the hosting proxy. Set `TRUST_PROXY=1` only when the application is behind exactly one trusted proxy. Keep frontend `VITE_API_URL` empty for the supported same-origin setup. Secure cookies intentionally will not authenticate over plain production HTTP.

`render.yaml` declares the database URI and origin as deployment-supplied variables. It does not contain secrets or a demo database. Review authentication, backups, SMTP, capacity and monitoring with your deployment configuration before operating on live data.

## Troubleshooting

| Symptom | Action |
|---|---|
| MONGODB_URI required | Create backend/.env and run commands from backend or use root npm scripts. |
| Replica set required / transactions rejected | Initialize a new development replica set or use Atlas. Do not reconfigure an existing deployment without its operator. |
| ECONNREFUSED / server selection timeout | Start mongod, confirm the URI/port, Atlas network access and credentials. |
| Untrusted request origin | Make APP_ORIGIN exactly match the URL you open, including scheme, hostname and port. |
| Registration has no hostels | Create a real hostel as administrator, or explicitly seed the development database. |
| Invalid student/room during migration | Verify source assignments; dry-run blocks inconsistent data. |
| Quantity mismatch | Scan one active label for each declared garment; report discrepancies instead of bypassing verification. |
| Cannot deliver | Order must be Ready, incident-free, and the scanned active tag must belong to that received order. |
| Camera unavailable | Grant permission, use HTTPS/localhost, or use manual payload entry. |
| Forgot Password unavailable | Configure SMTP and verify provider delivery. |
| Test MongoDB open error in constrained Linux environment | The test runner already uses `--nounixsocket`; check filesystem/socket restrictions and MongoDB binary compatibility. |
| Browser executable missing | Run `npx playwright install chromium` from frontend. |

Original project credit: Priyanshi. Existing portal workflows and visual assets were preserved and improved.

## Final verification follow-up — 11 October 2026

A fresh extraction of the delivered archive (without `.env` or `node_modules`) installed successfully with `npm ci --prefix backend` (163 packages) and `npm ci --prefix frontend` (36 packages). Verification ran on Linux, Node 24.19.0/npm 11.9.0; native Windows installation has not been executed here. The npm proxy/colour environment warnings did not fail any check.

| Exact command/check | Actual result |
|---|---|
| `npm test --prefix backend` | 45/45 passed, repeated in the fresh installation |
| `npm run lint --prefix frontend` | Passed |
| `npm run build --prefix frontend` | Passed |
| `npm run test:e2e --prefix backend` | 4/4 passed, repeated in the fresh installation |
| `npm audit --prefix backend --omit=dev` | 0 reported vulnerabilities |
| `npm audit --prefix frontend --omit=dev` | 0 reported vulnerabilities |
| `npm start` from the fresh backend | Actual server.js entry started; `/api/health` returned 200/ready against a disposable replica |
| `npm run dev -- --host localhost --port 5173 --strictPort` from the fresh frontend | Vite ready on localhost:5173; `/student` returned HTTP 200 |
| Read-only connection to the supplied local MongoDB URI | Unavailable in this workspace: MongooseServerSelectionError |

API tests exercise the protected operations directly, including an Admin-only endpoint matrix against both Student and Staff sessions, Student ownership and foreign-hostel restrictions. Restart verification logs into a child backend process, creates a hostel through its API, stops that process, starts another against the same isolated replica, and verifies the exact created record, persisted session, delivered order and billing. These tests do **not** prove persistence of your particular Windows deployment.

The supplied `.env` and legacy `data/db.json` still match the original upload byte-for-byte. No configured-database writes, account bootstrap, migration, cleanup, password reset or replica-set reconfiguration were performed. Consequently the existing admin credentials were not modified by this work; the live account/password could not be checked because your Windows localhost is inaccessible here.

Verified fixes in this follow-up: Student complaints now show the stored resolution and timestamp; rate-limit responses now return useful JSON messages instead of an unparseable text error. Limits remain 300 API requests/minute and 30 authentication requests/15 minutes. The expanded browser suite respects that rate-limit window rather than raising/bypassing the limits.

No UI-only placeholder was identified in the tested journeys or control-handler review. This is not an assertion that every possible button state was exhaustively tested. Provider email delivery, actual camera decoding, physical printing, production HTTPS/proxy behaviour and native Windows execution remain device/deployment checks. SMTP is currently unconfigured; password-recovery requests correctly report that limitation. There is no payment collection gateway; billing states **Not collected**. ETA is a configured rule-based estimate. Large portal lists currently preload bounded API pages for client-side filters.

### Safe manual acceptance on your Windows computer

1. Keep your existing `backend/.env`, database files and MongoDB service/rs0. Copy the updated source without replacing those items. Do not run bootstrap, migration or cleanup for this verification.
2. In `Smart_Wash-main`, run the dependency commands above, then start backend and frontend in the two PowerShell windows above. Use Node 22.12+ and the exact frontend origin `http://localhost:5173`. API is `http://localhost:5000`; confirm `/api/health` reports ready. If desired, inspect `rs.status()` read-only and confirm PRIMARY. Do not initiate/reconfigure the replica set.
3. Sign in at `http://localhost:5173/admin` with your existing admin credentials. This checks the live account preservation. In Hostels, create a clearly named verification hostel with one room, or edit an authorized non-sensitive field. Record its ID/name. Refresh, stop **only the backend** with Ctrl+C, restart it, sign in and confirm the same record remains. Retain it for inspection; do not delete existing records.
4. Through Admin, configure that hostel's pickup days/capacity/pricing and provision a clearly identified test Staff account assigned to it. Register a new Student at `/student` in its valid room. Check duplicate email and invalid password validation, then log in and submit a small eligible booking.
5. At `/staff`, verify that only the assigned hostel queue is accessible. Open QR Scanner, verify the laundry ID and one active garment tag per declared item, record the actual weight and accept. Check that invalid tags, duplicate scans and skipped stages are rejected. Advance Received → Washing → Drying → Ready.
6. Refresh Student tracking to check the persisted state and fee statement. Staff verify an active tag belonging to that order and deliver; Student acknowledge collection in the statement. Confirm the statement does not assert a payment.
7. Submit a Student complaint; Admin assign it to authorized Staff; Staff resolve with an explanation. Student must see the status and resolution. Inspect Admin monitoring filters, operational analytics, announcements/notifications and audit history.
8. While signed in as Student, enter `/admin` and `/staff`: the page must return to `/student`. In browser developer tools, `fetch('/api/dashboard/admin').then(r=>console.log(r.status))` must report 403. For a signed-in Staff user the same Admin endpoint must report 403; another hostel's queue must also be blocked. Logged-out protected endpoints must report 401.
9. Check phone-width navigation, form labels, search/status/date filters, logout, refresh, theme, empty states, manual scan fallback and camera permissions. Test a printed QR with your real camera. Configure SMTP only if you want email recovery/verification, then test provider delivery separately.
10. For isolated automated tests, stop the two application terminals to free ports 5000/5173, leave your MongoDB installation unchanged, install Chromium with `Set-Location .\frontend; npx playwright install chromium; Set-Location ..`, then run the four test/lint/build commands above. The runner uses its own disposable database and may download its MongoDB binary on first execution.


## Premium UI and lightweight 3D

The sign-in landing page includes a native CSS 3D washing-machine illustration: front/top/side surfaces, a reflective drum, softly lit stage and floating SVG garments. It uses no WebGL, external model/image download, new package or GPU-dependent runtime. Pause/resume stops the decorative motion. `prefers-reduced-motion: reduce` disables animation and hides the unnecessary motion control; unsupported `preserve-3d` capabilities show the same illustration flattened, while authentication stays usable. Rendering without WebGL works normally.

Portals retain their real API workflows. Admin has balanced KPI cards, charts and operational filters. Student has a semantic current-step progress list (horizontal on desktop, vertical on mobile), compact pickup-day labels and a direct booking action. Staff has a direct scanner action, readable queue cards and touch-size controls. Shared navigation, tables, focus styles and light/dark surfaces are refined; dashboards contain no 3D scene or animated charts. Tab changes reset content scrolling. Direct role sign-in pages use a compact header on phones, and the landing theme control is clear of the form/portal selector. No dependencies changed. The production CSS is about 9.15 KB gzip, including the pre-existing styles; the main JS entry is about 67.75 KB gzip.

Actual browser captures are included under `ui-preview/` in the deliverable, as explicitly requested. They use disposable, clearly identified QA records, never the user's account or database. They are screenshots of the implemented React application, not image-generation mockups. See the single checklist for the final UI checks. Live Windows login, physical camera/printing and email provider checks retain the previously documented limitations.


UI verification commands: `npm run lint --prefix frontend` passed, `npm run build --prefix frontend` passed, `npm run test:e2e --prefix backend` passed 4/4 after the final refinements, and `npm test --prefix backend` passed 45/45 after the initial UI integration. No backend code changed in this UI follow-up. Browser checks cover real booking/scanning/monitoring welcome actions, current-step tracking, keyboard animation pause/resume, reduced-motion rendering, phone-width layout, theme, existing forms, auth/role restrictions and the laundry/complaint lifecycle. The capability fallback is implemented in CSS; an actual obsolete browser without 3D-transform support was not available for testing. The final archive contains `ui-preview/landing.png`, `admin.png`, `student.png`, `staff.png`, `landing-mobile-reduced-motion.png` and `admin-mobile-dark.png`.
