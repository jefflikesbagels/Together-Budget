# Together Budget

A modern, browser-based budgeting app for couples. Track **his & hers** income, expenses, savings, and **disposable income** — aligned with the **50/30/20** rule.

## Where is data stored?

| How you run the app | Where data lives |
|---------------------|------------------|
| **`node server.js` (recommended)** | `data/budget.json` on the machine running the server — **one shared budget** for both partners |
| Static host only (e.g. Live Server, no `server.js`) | Each browser’s **localStorage** only — partners do **not** see each other’s data |

For two people on different phones or laptops, use the **server** and give them the same URL (e.g. `http://192.168.1.50:3000` on your home Wi‑Fi).

## Run with shared server (couples)

1. Open a terminal in this folder.
2. Start the server:

```bash
node server.js
```

Or, if you have npm:

```bash
npm start
```

3. On the computer running the server, open **http://localhost:3000**
4. On the other partner’s device (same Wi‑Fi), open **http://&lt;server-computer-ip&gt;:3000**  
   Example: `http://192.168.1.50:3000`  
   The terminal prints the data file path; use your PC’s LAN IP for other devices.

Edits save to the server automatically. The app polls every ~12 seconds so changes from the other partner appear when you’re not typing.

### Optional password

If the app is reachable from the internet, set a shared secret:

**Windows (PowerShell):**

```powershell
$env:BUDGET_SECRET = "your-long-random-secret"
node server.js
```

**macOS / Linux:**

```bash
BUDGET_SECRET=your-long-random-secret node server.js
```

Both partners open once with the key in the URL (bookmark this):

```
http://your-server:3000/?key=your-long-random-secret
```

The key is stored in the browser session for later visits.

## Features

- **Partner income** — Separate cards, renameable, multiple income lines
- **Expenses** — Needs, wants, savings; each line tagged **His**, **Hers**, or **Combined**
- **50/30/20** — Donut chart and progress vs. combined income
- **Other needs** — Sinking funds (count toward needs)
- **Export** — `Ctrl+S` downloads JSON backup
- **Reset** — Clears the shared budget when using the server

## Data file

Server budget file:

```
data/budget.json
```

Back this up if you move computers. It is listed in `.gitignore` so personal numbers are not committed to git by accident.

### Sample starting budget

Two example files ship with the project (placeholder names **Alex** / **Jordan**, ~$9,600/mo combined income, 50/30/20-style categories):

| File | Use when |
|------|----------|
| `data/budget.sample.json` | **Server format** — copy/rename to `data/budget.json` while the server is stopped |
| `sample-budget-export.json` | **Import format** — use the **Import** button in the app (same shape as Ctrl+S export) |

**Option A — replace server file (server stopped):**

```powershell
copy "data\budget.sample.json" "data\budget.json"
```

Then start the server and refresh the page.

**Option B — import in the app:** click **Import** and choose `sample-budget-export.json`.

## Disposable income

```
Disposable = Combined income − (Needs + Wants + Savings + Other needs)
```

## 50/30/20 rule

| Category | Target |
|----------|--------|
| Needs | 50% of combined take-home |
| Wants | 30% |
| Savings | 20% |

## Privacy

- **Server mode:** Data stays on your machine (or wherever you host `server.js`), not in the cloud unless you deploy it there.
- **Static-only mode:** Data stays in each browser’s localStorage.
