# K-Claims

A personal tracker for K-pop claims, group orders, and merch — built on top of a single [Notion](https://www.notion.com) database as the source of truth.

Keep an eye on everything in one place: what you claimed, from which GOM and shop, for which member, how much you paid (init / EMS / customs / domestic shipping), what's still due, and where every item currently is — with a yearly spending dashboard and a mobile-friendly UI.

## Features

- **Dashboard**: total spent (per year), amounts still to pay, breakdown by init / EMS / customs / domestic shipping, spend per month and per GOM.
- **Filters & search**: by group, comeback, category, shop, GOM, status, and member (member/comeback options narrow down based on the selected group).
- **Two views**: a single flat table, or tables grouped by comeback (active comebacks first).
- **Quick edit**: click a row to see read-only details plus the fields you change often (status, batch filled, notes, payments) — full edit with a dedicated button.
- **Claim management**: create, edit, duplicate, and delete claims straight from the UI (writes back to Notion).
- **Images**: upload an image when creating a claim; preview in the table and open it full-size on click.
- **GOM links**: group order manager names link to their Instagram profile.
- **Export**: one-click CSV or JSON backup.
- **Themes**: a neon "arcade" theme and a pastel "minsung" theme, switchable and persisted.
- **Responsive**: works on desktop and mobile.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (no npm dependencies).
- A Notion account and an integration token.

## Getting started

### 1. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new **internal integration**.
2. Copy the **secret token** (starts with `ntn_`).

### 2. Create the database

Create a Notion database (or duplicate an existing one) with these properties:

| Property        | Type                 | Notes                                  |
| --------------- | -------------------- | -------------------------------------- |
| `Item`          | Title                | claim / POB / merch name               |
| `Group`         | Select               | e.g. ATEEZ, SKZ, P1H…                  |
| `Comeback`      | Select               | e.g. GHP6, BLOW UP…                    |
| `Category`      | Select               | Album / POB / Merch / Altro            |
| `Shop`          | Select               |                                        |
| `GOM`           | Select               | group order manager                    |
| `Status`        | Select               | lifecycle, e.g. Claimed & Waiting…     |
| `Member(s)`     | Multi-select         |                                        |
| `Round`         | Number               |                                        |
| `Item type`     | Select               | album format or item kind              |
| `Claim type`    | Select               | POB only, Whole album + POB, split…    |
| `Init`          | Number               |                                        |
| `Init date`     | Date                 |                                        |
| `EMS`           | Number               |                                        |
| `EMS date`      | Date                 |                                        |
| `Customs`       | Number               |                                        |
| `Customs date`  | Date                 |                                        |
| `Doms`          | Number               | domestic shipping                      |
| `Doms date`     | Date                 |                                        |
| `Payment method`| Multi-select         |                                        |
| `Masterlist`    | URL                  |                                        |
| `Claimed`       | Date                 |                                        |
| `Batch filled?` | Checkbox             |                                        |
| `Notes`         | Rich text            |                                        |
| `IMG`           | Files & media        |                                        |

### 3. Configure

Set the integration token as an environment variable (the server also reads `~/.zshenv`):

```sh
export NOTION_TOKEN="ntn_..."
export NOTION_DB_ID="your-database-id-here"
```

> Note: both variables are read from the environment or from `~/.zshenv` (see `server/notion.js` → `getToken()` / `getDbId()`).

Share the database with the integration you created in step 1.

### 4. Run

```sh
node server/index.js
# or
npm start
```

Open <http://localhost:3000>.

## Architecture

```
k-claims/
├── server/
│   ├── index.js       # HTTP server: static files + /api routes (no framework)
│   ├── notion.js      # Notion API client
│   └── normalize.js   # maps the Notion database <-> the "claim" model
└── public/            # vanilla HTML/CSS/JS frontend
    ├── index.html
    ├── style.css
    ├── config.js      # editable config: group -> members/comebacks, status/category mappings
    └── app.js
```

The backend proxies all reads/writes to the Notion API; the token never leaves the server. The frontend is plain JavaScript with no build step.

## Limitations

- The Notion API cannot upload binary files — the `files` property only accepts external URLs. Uploaded images are stored locally in `public/uploads/` and referenced in Notion via a relative external URL.
- Group → members/comebacks mapping and status/category classifications live in `public/config.js` (editable config, no code changes required).

## Roadmap

- Support an external image host (Imgur/S3/Cloudinary) for uploads.
- Payment reminders with due dates.

## License

To be decided.
