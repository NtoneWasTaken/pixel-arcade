# 🎮 Pixel Arcade — Piattaforma Multiplayer Web

Piattaforma multiplayer browser.  
Nessuna registrazione richiesta. Gioca con gli amici tramite codice stanza.

**Stack:** React + Vite · Node.js · Socket.io · Render · Cloudflare Pages

---

## 📁 Struttura progetto

```
arcade/
├── client/                  # Frontend React (Vite)
│   ├── public/
│   │   └── _redirects       # Necessario per Cloudflare Pages SPA
│   ├── src/
│   │   ├── components/
│   │   │   └── TicTacToeBoard.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Lobby.jsx
│   │   │   └── Game.jsx
│   │   ├── socket/
│   │   │   └── socket.js    # Singleton Socket.io client
│   │   ├── styles/
│   │   │   └── main.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
└── server/                  # Backend Node.js
    ├── rooms/
    │   └── roomManager.js   # Gestione stanze in memoria
    ├── games/
    │   └── tictactoe.js     # Logica di gioco (server-authoritative)
    ├── server.js            # Entry point Express + Socket.io
    ├── package.json
    └── .env.example
```

---

## 🔌 Eventi Socket.io

| Evento (client → server) | Payload | Descrizione |
|---|---|---|
| `create_room` | `{ playerName }` | Crea una nuova stanza |
| `join_room` | `{ roomCode, playerName }` | Entra in una stanza esistente |
| `start_game` | — | L'host avvia la partita |
| `player_move` | `{ index }` | Invia una mossa (0–8) |
| `request_rematch` | — | Richiede rivincita |

| Evento (server → client) | Payload | Descrizione |
|---|---|---|
| `room_created` | `{ roomCode, player }` | Conferma creazione stanza |
| `player_joined` | `{ room }` | Notifica ingresso giocatore |
| `game_started` | `{ gameState }` | Partita avviata |
| `game_update` | `{ gameState }` | Stato aggiornato dopo mossa |
| `player_left` | `{ room, message }` | Giocatore disconnesso |
| `game_aborted` | `{ message }` | Partita interrotta |
| `rematch_ready` | `{ room }` | Rivincita pronta, torna alla lobby |
| `error` | `{ message }` | Errore generico |

---

## ⚡ Avvio locale

### Prerequisiti
- Node.js >= 18
- npm >= 9

### 1. Backend

```bash
cd server
npm install

# Crea il file .env
cp .env.example .env
# (modifica se necessario)

npm run dev    # sviluppo con nodemon
# oppure
npm start      # produzione
```

Il server parte su `http://localhost:3001`

### 2. Frontend

```bash
cd client
npm install

# Crea il file .env
cp .env.example .env
# Assicurati che VITE_BACKEND_URL=http://localhost:3001

npm run dev
```

Il client parte su `http://localhost:5173`

### 3. Test locale
1. Apri `http://localhost:5173` in due tab del browser
2. In un tab: inserisci nome → **Crea Stanza**
3. Copia il codice a 6 caratteri mostrato nella lobby
4. Nell'altro tab: inserisci nome → **Entra con codice** → incolla codice
5. Nell'host: clicca **▶ Inizia Partita**
6. Gioca!

---

## ☁️ Deploy su Render (Backend)

### Step 1 — Pubblica il codice su GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TUO_USERNAME/arcade-backend.git
git push -u origin main
```
> Puoi mettere solo la cartella `server/` in un repo separato, oppure il monorepo intero.

### Step 2 — Crea il servizio su Render

1. Vai su [render.com](https://render.com) → **New → Web Service**
2. Connetti il tuo account GitHub e seleziona il repo
3. Configura il servizio:

| Campo | Valore |
|---|---|
| **Name** | `arcade-backend` (o quello che vuoi) |
| **Root Directory** | `server` (se usi monorepo) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | `Free` |

4. Nella sezione **Environment Variables** aggiungi:

| Chiave | Valore |
|---|---|
| `FRONTEND_URL` | `https://TUO-PROGETTO.pages.dev` ← lo aggiungerai dopo il deploy Cloudflare |
| `NODE_ENV` | `production` |

> **Nota:** Render assegna automaticamente la variabile `PORT`. Non serve impostarla.

5. Clicca **Create Web Service**

### Step 3 — Ottieni l'URL del backend
Dopo il deploy (2–3 minuti), Render ti fornisce un URL tipo:
```
https://arcade-backend-xxxx.onrender.com
```
**Salvalo** — ti servirà per il frontend.

> ⚠️ Il piano Free di Render va in sleep dopo 15 minuti di inattività.  
> Al primo accesso ci possono volere 30–60 secondi per il "cold start".  
> Considera un piano a pagamento o un cron job di keep-alive per produzione.

---

## ☁️ Deploy su Cloudflare Pages (Frontend)

### Step 1 — Pubblica il frontend su GitHub
```bash
# Se usi monorepo, il repo è già su GitHub.
# Se vuoi repo separato:
cd client
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TUO_USERNAME/arcade-client.git
git push -u origin main
```

### Step 2 — Crea il progetto su Cloudflare Pages

1. Vai su [pages.cloudflare.com](https://pages.cloudflare.com) → **Create a project**
2. Seleziona **Connect to Git** → autorizza GitHub → scegli il repo
3. Configura il build:

| Campo | Valore |
|---|---|
| **Project name** | `pixel-arcade` |
| **Framework preset** | `Vite` |
| **Root directory** | `client` (se monorepo) oppure `/` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

4. Nella sezione **Environment variables** aggiungi:

| Chiave | Valore |
|---|---|
| `VITE_BACKEND_URL` | `https://arcade-backend-xxxx.onrender.com` ← URL del tuo Render |

5. Clicca **Save and Deploy**

### Step 3 — Aggiorna CORS sul backend
Ora che conosci l'URL di Cloudflare Pages (es. `https://pixel-arcade.pages.dev`),
torna su Render → Environment Variables → aggiorna `FRONTEND_URL`:
```
FRONTEND_URL=https://pixel-arcade.pages.dev
```
Render farà un redeploy automatico.

---

## 🔄 Workflow deploy aggiornamenti

```bash
# Modifica il codice, poi:
git add .
git commit -m "feat: nuova funzionalità"
git push origin main
# → Render e Cloudflare Pages fanno il redeploy automatico
```

---

## 🧩 Aggiungere un nuovo gioco

1. **Server:** crea `server/games/nuovogioco.js` con `initGame()` e `handleMove()`
2. **Server:** importa e gestisci in `server.js` (segui il pattern Tic Tac Toe)
3. **Client:** crea `client/src/components/NuovoGiocoBoard.jsx`
4. **Client:** crea `client/src/pages/NuovoGioco.jsx`
5. **App.jsx:** aggiungi la schermata nel router

---

## 🐛 Troubleshooting

**"Stanza non trovata"**  
→ Il server Render è in sleep. Aspetta 30–60s e riprova.

**Connessione Socket.io fallisce**  
→ Controlla che `VITE_BACKEND_URL` punti all'URL Render corretto (senza `/` finale).

**CORS error in console**  
→ Aggiorna `FRONTEND_URL` su Render con l'URL esatto di Cloudflare Pages.

**Variabili d'ambiente non lette (Vite)**  
→ Le variabili Vite devono iniziare con `VITE_`. Rebuild dopo ogni modifica alle env.

---

## 📜 Licenza
MIT — libero uso, modifica e redistribuzione.
