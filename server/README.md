Google Sheets backend for TradeLog

Overview
--------
This small Express backend exposes a minimal API to use a Google Spreadsheet as the datastore for NSE symbols. It is intended to run on a secure server (Cloud Run, Heroku, Render, etc.).

Endpoints
---------
- GET /api/nse — returns all rows as JSON (header row becomes keys)
- POST /api/nse/append — append a row (JSON object matching header)
- POST /api/nse/update — update an existing row by `sym` (body must include `sym`)

Setup
-----
1. Create a Google Cloud Project and enable the Google Sheets API.
2. Create a Service Account and generate a JSON key.
3. Create a Google Spreadsheet (Sheet1). Add a header row matching your fields, e.g. `sym`, `name`, `sector`.
4. Share the spreadsheet with the service account email as Editor.
5. Set environment variables for the service before starting the server:

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",... }' # entire JSON string
export SPREADSHEET_ID=your_spreadsheet_id_here
export API_KEY=your_api_key_here
node index.js
```

Deployment
----------
You can deploy to Cloud Run or any Node-supporting host. For Cloud Run, use the service account key via Secret Manager and set required env vars securely.

Security
--------
- Keep `GOOGLE_SERVICE_ACCOUNT_JSON` secret (do not commit it).
- Use `API_KEY` to prevent unauthorized writes from the browser. For stronger security, add auth (JWT, OAuth) in front of the backend.
