# Privacy Policy — Architect Companion

_Last updated: May 2026_

## Overview

Architect Companion ("the extension") is a Chrome browser extension that manages Salesforce Architect Engagement records directly from your browser. It queries and updates Salesforce records using your active Salesforce browser session. This policy explains what data the extension accesses, how it is used, and what is never collected.

## Data Accessed

### Salesforce Session Cookie
The extension reads the `sid` session cookie from your active Salesforce browser session solely to authenticate API requests to Salesforce. This cookie is never transmitted to any server other than your own Salesforce instance (the domain configured in `config.json`).

### Salesforce Record Data
The extension queries and updates Salesforce records as configured in `config.json`. This includes:
- Reading engagement records owned by the current user to display in the Engagements tab
- Updating engagement status fields when buttons are clicked in the side panel, when the daily scheduler runs, when a scheduled call fires, or when an auto-revert timer expires
- Creating associated child records (e.g. activity records) as configured in button operations

All data is sent directly between your browser and your Salesforce instance. No record data is read, stored, or transmitted by the extension beyond what is necessary to perform the configured operations.

### Current User Identity
The extension calls the Salesforce `/services/oauth2/userinfo` endpoint to retrieve the currently logged-in user's name and ID. This is used to:
- Display the signed-in user's name in the extension header
- Filter all queries so that only records owned by the current user are shown and updated
- Verify record ownership before any write operation is executed

The user identity is not stored persistently and is not transmitted to any party other than your Salesforce instance.

## Data Stored Locally

The extension stores the following data in Chrome's local storage (`chrome.storage.local`) on your device only:

- **Scheduled run time** — the daily time configured for automatic runs
- **Active / Inactive state** — whether the extension is set to apply updates or run in preview-only mode
- **UI theme preference** — light or dark mode selection
- **Engagement view cache** — a short-lived cache (5-minute TTL) of engagement records fetched from Salesforce, used to reduce unnecessary API calls
- **Pending call timers** — a record of active auto-revert timers (engagement record ID, duration, scheduled revert time), used to cancel timers when End Call is clicked manually before the timer fires
- **Scheduled calls** — future call schedules (engagement record ID, scheduled date/time, duration) set by the user for calls to be triggered at a specific future time
- **Panel refresh signal** — a timestamp written by the background service worker to notify the side panel when data has changed; contains no personal or record data
- **Engagement View logs** — a history of engagements tab actions including cache hits, database pulls, button operation results, scheduled call events, auto-reverts, and errors (up to 200 entries)
- **Daily Scheduler logs** — a history of scheduled and manual run results including timestamps, record counts, permission checks, and any errors (up to 200 entries)

All data stored locally never leaves your device and is not accessible to any third party.

## Data Never Collected

Architect Companion does **not**:

- Collect, transmit, or share any personal data with the extension developer or any third party
- Send any Salesforce data, credentials, or session tokens to any external server
- Use analytics, telemetry, crash reporting, or tracking of any kind
- Store data in any remote database or cloud service
- Access any Salesforce records not owned by the current session user
- Inject scripts into any web page

## Ownership Enforcement

Before executing any write operation on a Salesforce record, the extension verifies that the target record is owned by the current session user by querying Salesforce directly. If the record is not owned by the current user, the operation is blocked entirely. This check is enforced at the service worker level and cannot be bypassed from the UI.

## Third-Party Services

The extension communicates exclusively with:

- Your own Salesforce instance (the domain you configure in `config.json`)

No other third-party services, APIs, or servers are contacted.

## Configuration File

The `config.json` file bundled with the extension contains all query, update, display, and button operation settings. This file is stored locally within the extension package on your device and is not transmitted anywhere. The extension reads this file on every operation and has no mechanism to write to it at runtime.

## Chrome Permissions

The extension requests the following Chrome permissions:

- **cookies** — to read your active Salesforce session for authentication
- **storage** — to save preferences, cache, timers, scheduled calls, and logs locally on your device
- **alarms** — to trigger the daily scheduled run and auto-revert timers
- **notifications** — to alert when a run completes or fails
- **sidePanel** — to render the extension UI as a persistent Chrome side panel

Network access is restricted to Salesforce domains only (`*.salesforce.com`, `*.force.com`, `*.my.salesforce.com`, `*.lightning.force.com`).

## Changes to This Policy

If this policy is updated, the new version will be published to this repository with an updated date at the top of this document.

## Contact

For questions about this privacy policy, please open an issue in the GitHub repository where this extension is hosted.
