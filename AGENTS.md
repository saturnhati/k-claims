# K-Claims

Tracker personale per claim kpop (album / POB / merch), backend locale Node.js + frontend vanilla, con **Notion come fonte di verità** (un unico database unificato).

## Avvio

```sh
cd ~/k-claims
node server/index.js        # oppure `npm start`
```

- Porta: `http://localhost:3000`
- Zero dipendenze npm (solo Node >= 18).
- **Token Notion NON è nel repo**: viene letto da `~/.zshenv` (`NOTION_TOKEN`, inizia con `ntn_`). Il server lo trova via `server/notion.js` → `getToken()` (legge `process.env` e poi `~/.zshenv`/`~/.zshrc`/etc.).
- **ID del DB Notion** anch'esso fuori dal repo: letto da `~/.zshenv` (`NOTION_DB_ID`) via `getDbId()` (stesso meccanismo di `getToken()`).
- Per far ripartire il server dopo modifiche al backend: `pkill -f "node server/index.js"` e rilancio.

## Struttura

- `server/index.js` — server HTTP (file statici + API `/api/*`), nessun framework.
- `server/notion.js` — client Notion (fetch), `getToken`, `getDatabase`, `queryDatabaseAll`, `createPage`, `updatePage`, `archivePage`, `createDatabase`.
- `server/normalize.js` — mappa il DB Notion ↔ modello "claim" (`normalizeRow`, `claimToProperties`, `buildMeta`). Qui ci sono i **nomi dei campi Notion**; l'**ID del DB** arriva da `NOTION_DB_ID` (vedi `resolveDbId()`).
- `public/` — frontend vanilla: `app.js`, `style.css`, `index.html`.
- `public/config.js` — config editabile: mappatura **gruppo → membri/comeback** (`GROUP_MEMBERS`, `GROUP_COMEBACKS`), classificazione status (`CANCELLED`, `DONE`, `ARCHIVED`), etichette categoria (`CAT_LABEL`) e ordinamento status (`STATUS_RANK`). Caricato prima di `app.js`.
- `public/uploads/` — immagini caricate dal sito (GITIGNORED, sono le foto personali dei claim).

## Modello dati (DB Notion "K-Claims · TEST")

Campi: `Item` (title), `Group`, `Comeback`, `Category` (Album/POB/Merch/Altro), `Shop`, `GOM`, `Status`, `Member(s)`, `Round`, `Item type`, `Claim type`, `Init` + `Init date`, `EMS` + `EMS date`, `Customs` + `Customs date`, `Doms` + `Doms date`, `Payment method`, `Masterlist`, `Claimed`, `Batch filled?`, `Notes`, `IMG`.

Endpoint API principali: `GET /api/meta`, `GET /api/claims`, `POST /api/claims`, `PATCH /api/claims/:id`, `DELETE /api/claims/:id` (archivia), `POST /api/upload` (salva in `public/uploads/` e restituisce URL relativo).

## Scelte / decisioni chiave

- Notion resta la fonte dei dati: il sito legge e scrive in tempo reale (create/update/delete).
- **"Pagato"** = importo con data di pagamento; **"Da pagare"** = importo segnato ma senza data.
- Mappatura **gruppo → membri/comeback** e classificazioni status/categoria in `public/config.js` (`GROUP_MEMBERS`, `GROUP_COMEBACKS`, `CANCELLED`, `DONE`, `ARCHIVED`, `CAT_LABEL`, `STATUS_RANK`) — usate per filtri dipendenti, form e rendering.
- Il campo album si chiama ora `Item type` (include anche Season's Greetings, Lightstick, ecc.).
- Temi: **arcade** (verde lime `#b1ff08` + viola `#8b5cf6`) e **minsung** (rosa-verde pastello), toggle in alto a destra, persistito in `localStorage` (`kc-theme`).
- Notion **non supporta l'upload di file via API** (solo URL esterni): il caricamento immagini salva in `public/uploads/` e imposta `IMG` con URL relativo esterno.

## Git / GitHub

Repo **pubblica**: `https://github.com/saturnhati/k-claims` (remote SSH `git@github.com:saturnhati/k-claims.git`, branch `main`).
Commit/push: `git add -A && git commit -m "..." && git push`.
`.gitignore` esclude `node_modules/`, `public/uploads/`, `.DS_Store`, `*.log`, `.env`.

## TODO — da rivedere (preparazione open-source)

1. ~~Spostare l'ID del DB Notion~~ → fatto: letto da `NOTION_DB_ID` (env o `~/.zshenv`) via `getDbId()`.
2. ~~Spostare `GROUP_MEMBERS`/`GROUP_COMEBACKS` in un file di config editabile~~ → fatto: `public/config.js`.
3. **Immagini**: oggi usano il server locale; per l'open-source serve un host esterno (Imgur/S3/Cloudinary) o documentare il funzionamento locale.
4. ~~Rimuovere/rendere opzionali i riferimenti hardcoded~~ → fatto: status/categoria spostati in `public/config.js`, rimossi i `FRIENDS`; i link GOM restano `instagram.com` (scelta voluta).
5. Aggiungere un **README** (requisiti, setup token Notion, come creare il DB, avvio).
6. ~~Scegliere una licenza~~ → fatto: MIT (`LICENSE`).

## Idee future (non implementate)

- Promemoria pagamenti (rimandato dall'utente).
- Ripartizione "spesa per metodo di pagamento" (Revolut/Paypal/Bancomat Pay).
- "Da pagare" contestualizzato o con scadenze.
