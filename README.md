# Fatt' APPosta / NapoliOS

Prototipo interattivo composto da due interfacce collegate:

- **`index.html` — Fatt' APPosta**: PWA mobile-first per il cittadino (onboarding, accesso/ospite, chat con note vocali, allegati e widget operativi per eventi, percorsi, piano di rientro, biglietto demo e avvisi comunali).
- **`napolios.html` — NapoliOS**: sala operativa simulata del Comune di Napoli con modello 3D della città (`assets/city/napoli.glb`), rete di trasporto (`assets/city/transit.json`), livelli GeoJSON (`geo/*.geojson`), elenco eventi, stato degli agenti e registro delle decisioni.

> **Nota sui dati:** tutte le conversazioni, le chiamate agli agenti, i flussi di traffico e le decisioni mostrate negli scenari sono **simulati** e guidati localmente da script JSON deterministici (`scenari/*.json`), senza backend o modelli LLM esterni collegati.

## Avvio in locale

L'applicazione utilizza ES Modules, `fetch` su file JSON/GeoJSON/GLB e un Service Worker: va quindi servita tramite un server HTTP statico (non aprendo i file con `file://`).

Dalla root del repository:

```bash
python -m http.server 8000
```

Oppure con Node.js:

```bash
npx serve .
```

Poi apri nel browser `http://127.0.0.1:8000/`.

## Scenari interattivi

Puoi provare le interfacce direttamente in modalità libera (`index.html` / `napolios.html`) oppure avviare gli scenari scriptati tramite il parametro `?scena=`.

### Lato cittadino (`index.html`)

- **Serata a Napoli (flusso completo):** `http://127.0.0.1:8000/index.html?scena=s1&autoplay=1`
- **Notifica avviso dal Comune:** `http://127.0.0.1:8000/index.html?scena=s2-avviso&autoplay=1`
- **Richieste rapide:** `?scena=q1`, `?scena=q2`, `?scena=q3`
- **Scena minima di test:** `?scena=prova`

### Lato Comune (`napolios.html`)

- **Apertura rete TPL su Napoli 3D:** `http://127.0.0.1:8000/napolios.html?scena=apertura&autoplay=1`
- **Ingorgo Via Marina (autonomia A2):** `http://127.0.0.1:8000/napolios.html?scena=l1&autoplay=1`
- **Ambulanza con onda verde (autonomia A3):** `http://127.0.0.1:8000/napolios.html?scena=s2&autoplay=1`
- **Regolazioni notturne e firma operatore (A2/A4):** `http://127.0.0.1:8000/napolios.html?scena=notte&autoplay=1`
- **Visione d'insieme e corridoio illuminato:** `http://127.0.0.1:8000/napolios.html?scena=visione&autoplay=1`
- **Vista sola mappa / layer dati:** `http://127.0.0.1:8000/napolios.html?scena=dati&autoplay=1&vista=mappa`

### Controlli di regia

Quando è attivo `?scena=` (senza `&regia=0`), puoi controllare la timeline da tastiera:

- `Spazio`: avvia / metti in pausa
- `→` oppure `N`: passo successivo
- `R`: riavvia la scena
- `1–9`: passa tra le scene della pagina
- `H`: mostra / nascondi il pannello di regia

Parametri aggiuntivi supportati: `&regia=0` (nasconde il pannello di regia) e `&velocita=2` (moltiplicatore di velocità).

## Struttura del repository

- `index.html`, `manifest.webmanifest`, `sw.js`: guscio PWA del cittadino
- `napolios.html`: sala operativa 3D del Comune
- `css/`: token di design e fogli di stile (`tokens.css`, `styles.css`, `napolios.css`)
- `js/`: moduli applicativi, motore a timeline (`engine.js`, `regia.js`) e renderer 3D / simulazione mobilità (`js/city/`)
- `assets/`: modello 3D di Napoli (`city/napoli.glb`), dati TPL (`city/transit.json`), font Poppins self-hosted (`fonts/`) e icone (`icons/`)
- `geo/`: layer geografici (assi stradali, semafori, percorsi, aree di rischio)
- `scenari/`: script JSON deterministici delle scene
