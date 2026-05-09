# Architect Companion — Technical Overview

**Version:** 1.0.0  
**Platform:** Google Chrome (Manifest V3)  
**Repository:** https://github.com/sgummalla/sf_architect_helper_chrome_ext  
**Last updated:** May 2026

---

## 1. Purpose

Architect Companion is a Chrome browser extension that surfaces Salesforce Architect Engagement records directly in a browser side panel and automates a configurable daily status update. It eliminates manual, repetitive Salesforce record updates for users who manage multiple active engagements.

---

## 2. Architecture

### 2.1 Components

| Component | File | Role |
|---|---|---|
| Background Service Worker | `background.js` | All Salesforce API calls, alarm scheduling, data processing |
| Side Panel UI | `popup.html` / `popup.js` | Rendering, user interaction, event handling |
| Configuration | `config.json` | Bundled read-only file — all queries, fields, and button behaviour |
| Manifest | `manifest.json` | Chrome extension declaration, permissions, entry points |

### 2.2 Runtime Model

The extension runs as a Chrome Manifest V3 extension. The background service worker is ephemeral — Chrome starts it on demand (alarm fire, user interaction, message) and terminates it after inactivity. This is Chrome's standard lifecycle; it does not affect reliability because all persistent state is stored in `chrome.storage.local` and all scheduled work uses `chrome.alarms`, both of which survive service worker termination.

The side panel (equivalent to a browser popup but persistent) communicates with the service worker via `chrome.runtime.sendMessage`. Background-initiated refreshes (daily run completion, scheduled call fires, auto-reverts) are signalled to the side panel via `chrome.storage.onChanged`, which fires reliably across all extension contexts.

### 2.3 Configuration Architecture

All operational behaviour is defined in `config.json`, a static JSON file bundled with the extension package. The file is read fresh on every operation — it is never cached in memory or copied to storage. The extension provides no mechanism to write to this file; it can only be changed by editing the file and reloading the extension.

---

## 3. Chrome Permissions

| Permission | Why Required |
|---|---|
| `cookies` | Reads the active Salesforce `sid` session cookie to authenticate API calls. Only the configured Salesforce domain is accessed. |
| `storage` | Persists user preferences (scheduled time, active/inactive state, theme), engagement cache, pending timers, scheduled calls, and log history in local device storage. |
| `alarms` | Schedules the daily automated run and auto-revert timers. Chrome alarms survive service worker termination and browser restarts. |
| `notifications` | Displays desktop notifications when the daily scheduler completes or fails. |
| `sidePanel` | Enables the extension to render its UI as a Chrome side panel (persistent alongside the browser window). |

**Host permissions** are restricted to Salesforce domains only:
- `https://*.salesforce.com/*`
- `https://*.force.com/*`
- `https://*.my.salesforce.com/*`
- `https://*.lightning.force.com/*`

No other domains are contacted.

---

## 4. Network Communication

All network requests originate from the browser and are directed exclusively to the Salesforce instance domain configured in `config.json`. The extension makes the following categories of API call:

| Call | Endpoint | Purpose |
|---|---|---|
| Session validation | `GET /services/oauth2/userinfo` | Retrieve current user ID and display name |
| Engagement query | `GET /services/data/{v}/query?q=…` | Fetch engagement records for the side panel |
| Ownership verification | `GET /services/data/{v}/query?q=SELECT Id FROM {object} WHERE Id = ? AND OwnerId = ?` | Confirm a record belongs to the current user before any write |
| SOQL field lookups | `GET /services/data/{v}/query?q=…` | Resolve dynamic field values in button operations (e.g. resource lookup) |
| Child record ID resolution | `GET /services/data/{v}/query?q=…` | Locate child records for filter-based update operations |
| Composite write | `POST /services/data/{v}/composite` | Atomic create/update operations via Salesforce Composite API |
| Daily bulk update | `GET` then `PATCH` per record | Daily scheduler reads then updates matched records individually |
| Permission check | `GET /services/data/{v}/sobjects/{object}/describe` | Daily scheduler verifies object and field-level update permissions before writing |

**No data is sent to any server other than the configured Salesforce instance. No analytics, telemetry, or tracking calls of any kind are made.**

---

## 5. Authentication

The extension does not store or manage credentials. It reads the `sid` session cookie that the browser already holds from the user's active Salesforce login. This is the same cookie that authenticates requests when the user navigates Salesforce in a normal browser tab. The cookie is passed in the `Authorization: Bearer` header of API requests and is never written to storage or transmitted elsewhere.

If no Salesforce session cookie exists, all operations are blocked and the side panel displays "Not signed in".

---

## 6. Functionality

### 6.1 Engagements View

Displays Salesforce engagement records owned by the current session user in a card list within the side panel.

**Query behaviour:**
- Fields to fetch are defined in `engagementsView.query.fields`
- Filter conditions are defined in `engagementsView.query.conditions` with a `logic` expression
- The query **always** appends `AND {ownerFieldName} = '{currentUserId}'` — records not owned by the current user are structurally excluded from results
- Results are cached in `chrome.storage.local` for 5 minutes to reduce API calls. A manual refresh bypasses the cache.
- Maximum 50 records are returned (LIMIT 50 in the SOQL query)

**Card display:** Each card shows fields mapped in `engagementsView.cardDisplay` — name, title, stage badge, and status badge.

**Search:** A search bar filters visible cards by name and title in real time. Filtering is client-side only — no additional API calls are made.

### 6.2 Configurable Button Operations

Each engagement card displays action buttons defined in `engagementsView.buttons`. Each button has a `showWhen` condition controlling visibility based on the current record status:

| Button | `showWhen` | Default action |
|---|---|---|
| Set To Working | `"Waiting on Customer"` | Updates status to `In Progress` |
| Customer Call | `"default"` (not scheduled) | Updates status + creates Activity record |
| Set To Waiting On Customer | `"In Progress"` | Updates status to `Waiting on Customer` |
| End Call | `"scheduled"` | Updates status to `Waiting on Customer` |

Buttons, their labels, the statuses they respond to, and the Salesforce operations they perform are all defined in `config.json` and can be adjusted without changing any code.

**Execution pipeline for each button click:**

1. **Ownership guard** — queries Salesforce to confirm the record ID belongs to the current session user. If not, the operation is blocked immediately.
2. **Phase 0 — SOQL field lookups** — resolves any fields whose value must be fetched from Salesforce (e.g. a resource record ID keyed to the current user). Duplicate queries are deduplicated. If a lookup returns no results, the operation is aborted.
3. **Phase 1 — Filter-based child record resolution** — for operations targeting child records via a filter condition, queries child record IDs. Result count is checked against `maxRecords`; if exceeded, the operation is aborted.
4. **Phase 2 — Salesforce Composite API** — all resolved create and update operations are submitted as a single `POST /composite` request with `allOrNone: true`. Salesforce atomically commits or rolls back the entire batch. A maximum of 25 sub-requests per composite call is enforced.
5. **Cache invalidation** — the engagements cache is cleared on success so the next view load reflects the updated state.

**Supported operation types per button:**

- `update` with `id` — PATCH a specific record by ID (supports placeholders: `{recordId}`, `{duration}`, `{currentUserId}`, `{currentDate}`)
- `update` with `filter` — PATCH all child records matching a SOQL filter condition
- `create` — POST a new child record; fields support the same placeholders plus SOQL-resolved values

### 6.3 Auto-Revert Timer

When the Customer Call button is clicked, a `chrome.alarm` is created for the selected duration (30 seconds to 1 hour). When the alarm fires:

1. The service worker wakes up automatically (Chrome's standard alarm behaviour)
2. The End Call button's operations execute (status reverts to `Waiting on Customer`)
3. The pending call entry is removed from storage
4. The side panel is signalled to refresh if open

The timer can be cancelled at any time by clicking End Call manually, which clears the alarm and removes the pending entry before the timer fires.

### 6.4 Schedule Call

A clock icon on each engagement card opens an inline scheduling form. The user selects a future date, time, and call duration. On save:

1. A `chrome.alarm` is created for the specified future date and time
2. The schedule is persisted in `chrome.storage.local`
3. The card displays a pill showing the scheduled date/time with a cancel button (×)
4. When the alarm fires, the full Customer Call operation pipeline executes (ownership guard → SOQL lookups → Composite API), followed by the auto-revert timer for the selected duration

Cancelling removes the alarm and clears the stored entry. Any manual button click on a card also automatically cancels a pending scheduled call for that record.

### 6.5 Daily Scheduler

Runs automatically at the configured time each day. Also triggerable immediately via the Run Now button.

**Execution sequence:**

1. Read `sid` session cookie for the configured Salesforce domain
2. Call `/oauth2/userinfo` to identify the current session user
3. Call `/sobjects/{object}/describe` to verify object-level update permission
4. Verify field-level update permissions for each field in `updateFields`
5. Execute the SOQL query from `dailyScheduler.filters` with `AND {ownerFieldName} = '{userId}'`
6. If `records.length > maxRecords` → abort entirely, log the count, send desktop notification
7. If the extension is in **Inactive** mode → log the matched count, make no writes
8. If Active → send individual PATCH requests for each matched record
9. Log every result (success or failure per record)
10. Send a desktop notification with the summary
11. Invalidate the engagements cache and signal the side panel to refresh if open

---

## 7. Guard Rails and Safety Mechanisms

### 7.1 Ownership Enforcement

Every button action begins with an explicit Salesforce query confirming the target record is owned by the current session user:

```
SELECT Id FROM {object} WHERE Id = '{recordId}' AND {ownerFieldName} = '{currentUserId}'
```

If the record is not found or not owned by the current user, all operations are blocked and the error is logged. This is enforced at the background service worker level — the UI cannot bypass it.

The daily scheduler independently appends `AND {ownerFieldName} = '{currentUserId}'` to every query, ensuring bulk updates are always scoped to the session user's records.

### 7.2 maxRecords Safety Limit

`maxRecords` in `config.json` (default: 15) applies to two distinct paths:

- **Daily scheduler** — if the SOQL query returns more records than `maxRecords`, the entire run is aborted before any PATCH is sent. A desktop notification and log entry describe the abort.
- **Filter-based child record updates** — if resolving child record IDs via a filter returns more IDs than `maxRecords`, the composite request is blocked before it is built.

This prevents accidental bulk updates from runaway filter conditions.

### 7.3 Atomic Writes (Composite API — allOrNone)

All button operation writes use the Salesforce Composite API with `allOrNone: true`. Either every sub-request in a button click succeeds, or Salesforce rolls back all of them. There is no partial-success state where some records are updated and others are not.

### 7.4 Filter Logic Validation

Before any SOQL filter is built, `validateFilterLogic` checks the `logic` expression against the defined conditions:

- Every condition index (1, 2, 3…) must be referenced in the `logic` string
- The `logic` string must not reference condition indices that don't exist

Violations produce a descriptive error naming the exact config location and the offending condition, blocking execution before any API call.

Example error:
```
Invalid config in [dailyScheduler.filters]: logic "1 AND 2" does not reference condition 3
(field: "Stage__c", operator: "=", value: "Delivery").
Either add it to the logic string or remove the condition.
```

### 7.5 Permission Verification (Daily Scheduler)

Before the daily scheduler writes any data, it verifies:

- The target object is updateable by the current session user (via describe API)
- Each field in `updateFields` exists on the object and is updateable by the current session user

If any check fails, the run is aborted without touching any records.

### 7.6 Active / Inactive Mode

The extension can be set to **Inactive** via the header toggle. In this mode, the daily scheduler still runs its full query and logs the matched count, but sends no PATCH requests. This allows safe verification that filters are correct before enabling writes.

### 7.7 Composite API Sub-Request Limit

A hard limit of 25 sub-requests per Composite API call is enforced before the request is submitted. If a button's operations would exceed this (e.g. a filter-based update matching 26 child records), the operation is blocked with a clear error.

### 7.8 Config Immutability

`config.json` is read from the extension package using `chrome.runtime.getURL` on every operation. The extension has no API to write to its own package files. Once deployed, the configuration cannot be modified at runtime — only by reloading the extension from an updated package.

---

## 8. Local Data Storage

All data stored by the extension remains exclusively on the user's device in `chrome.storage.local`. It is never transmitted to any server other than the configured Salesforce instance, and never accessible to third parties.

| Storage Key | Contents | Cleared When |
|---|---|---|
| `sf_updater_config` | User preferences: scheduled time, active/inactive state, theme | Never automatically; updated on user interaction |
| `sf_engagements_cache` | Cached engagement records and metadata (5-minute TTL) | After any button action, daily run, or manual refresh |
| `sf_pending_calls` | Active auto-revert timers: record ID, duration, revert timestamp | When the call completes or is manually ended |
| `sf_scheduled_calls` | Future scheduled calls: record ID, scheduled timestamp, duration | When the alarm fires or the user cancels |
| `sf_panel_refresh` | Timestamp signal for background → side panel communication | Overwritten on each refresh signal |
| `sf_updater_logs` | Daily scheduler log entries (up to 200) | Manual clear by user |
| `sf_engagement_logs` | Engagement view log entries (up to 200) | Manual clear by user |

---

## 9. Logging and Auditability

Every Salesforce API call made by the extension is logged with a timestamp and level (INFO, OK, WARN, ERROR). Logs are split into two streams:

- **Engagement Logs** — all button actions: ownership checks, SOQL lookups, Composite API requests and responses per sub-request, auto-revert events, scheduled call events
- **Daily Scheduler Logs** — all scheduled/manual runs: session identity, permission checks, SOQL query text, per-record PATCH outcomes, abort reasons

Logs are visible in the side panel's Logs tab and are retained for up to 200 entries per stream. They are stored locally and never transmitted.

---

## 10. Service Worker Lifecycle

Chrome terminates the background service worker after approximately 30 seconds of inactivity. This is Chrome's standard Manifest V3 behaviour and does not affect reliability:

- `chrome.alarms` are owned by Chrome, not the service worker. They fire and wake the service worker regardless of whether it was active.
- `chrome.storage.local` persists across service worker termination and browser restarts.
- The side panel detects background-initiated data changes via `chrome.storage.onChanged` rather than a persistent message channel, which correctly handles the case where the service worker has been restarted between events.

---

## 11. What the Extension Does Not Do

- Does not collect, transmit, or share any data with the extension developer or any third party
- Does not use analytics, telemetry, crash reporting, or usage tracking of any kind
- Does not store credentials, passwords, or session tokens
- Does not access any Salesforce data beyond what is explicitly defined in `config.json`
- Does not make any network requests to domains other than the configured Salesforce instance
- Does not modify any Salesforce records not owned by the current session user
- Does not run in the background when the browser is closed
- Does not inject content scripts into any web page

---

## 12. Source Code

The complete source code is available at:  
**https://github.com/sgummalla/sf_architect_helper_chrome_ext**

The repository contains all extension files, build scripts, and documentation. The extension is loaded as an unpacked Chrome extension directly from this source directory.
