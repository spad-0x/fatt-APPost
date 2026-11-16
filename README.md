<p align="center">
  <img src="brand-kit/assets/brand/svg/logo-horizontal-dark.svg" alt="fatt APPost — logo ufficiale" width="640" />
</p>

# fatt APPost · NapoliOS

**Una città viva. Un’intelligenza che ti è vicina.**

Progetto realizzato nell’ambito dell’hackathon **The Big Hack@Futuro remoto**: un prototipo che mette in dialogo chi vive Napoli e chi si prende cura della città.

L’idea è semplice: rendere più accessibili le possibilità del territorio attraverso un assistente per il cittadino e affiancargli una sala operativa capace di mostrare la città nel suo insieme. Due prospettive, una sola Napoli.

**[Presentazione del progetto](https://sonic-pumice-yc4oggp-leonardospadoni01-5216s-projects.vercel.app/presentazione.html)** · **[Demo cittadino](https://sonic-pumice-yc4oggp-leonardospadoni01-5216s-projects.vercel.app/index.html?scena=s1&autoplay=1)** · **[Demo NapoliOS](https://sonic-pumice-yc4oggp-leonardospadoni01-5216s-projects.vercel.app/napolios.html)** · **[Video su YouTube](https://youtu.be/p-d13dCQQIo)**

> **Stato del progetto:** prototipo dimostrativo, non un servizio istituzionale del Comune di Napoli. Conversazioni, chiamate agli agenti, traffico e decisioni sono simulati tramite script JSON locali e un motore di mobilità deterministico. Non sono collegati backend, modelli LLM esterni o flussi di dati urbani in tempo reale.

## Il progetto

### Per chi vive la città: l’assistente cittadino

L’interfaccia mobile-first, presente nel prototipo anche con la denominazione **Fatt’ APPosta**, immagina un assistente tascabile per le attività quotidiane:

- onboarding e accesso in modalità ospite;
- chat con note vocali e allegati;
- eventi, percorsi e piano di rientro;
- biglietto dimostrativo e avvisi comunali;
- scenari guidati per raccontare una serata a Napoli e le interazioni con la città.

### Per chi si prende cura della città: NapoliOS

Una sala operativa simulata che riunisce:

- modello tridimensionale di Napoli;
- rete di trasporto multimodale e **mezzi che si muovono nella simulazione animata**;
- livelli geografici per assi stradali, semafori, percorsi e aree di rischio;
- elenco eventi, stato degli agenti e registro delle decisioni;
- scenari di mobilità, emergenza e coordinamento.

La demo NapoliOS parte automaticamente, anche aprendo la pagina senza parametri. Al termine dello scenario il movimento dei mezzi continua; la card conclusiva **“L’idea”** può essere nascosta con la **×** in alto a destra, senza interrompere la simulazione. Il pannello tecnico di regia è nascosto nell’interfaccia della sala operativa.

## Video di presentazione

[![Guarda il video di presentazione di fatt APPost su YouTube](https://i.ytimg.com/vi/p-d13dCQQIo/hqdefault.jpg)](https://youtu.be/p-d13dCQQIo)

**[▶ Guarda il video su YouTube](https://youtu.be/p-d13dCQQIo)**

La miniatura apre YouTube: il README non incorpora un player. Il sito di presentazione include invece un player caricato al clic su “play”.

## Brand identity

### Nome e segno

Il marchio si scrive **fatt APPost**, con **APP** in maiuscolo. La mano è il segno distintivo dell’identità; il wordmark utilizza **Sora SemiBold 600**. Nei marchi su fondo scuro, `fatt ` e `ost` sono bianchi e `APP` è evidenziato in menta.

La denominazione del marchio è distinta dai nomi storici ancora presenti in alcune schermate del prototipo. **NapoliOS** identifica la sala operativa.

### Palette e tipografia

| Ambito | Colore | HEX | Utilizzo |
| --- | --- | --- | --- |
| Marchio | Verde scuro | `#014630` | Fondo principale del marchio |
| Marchio | Bianco | `#ffffff` | Segno e parti del wordmark su fondo scuro |
| Marchio | Menta | `#9bf9a4` | Evidenziazione di APP su fondo scuro |
| Interfaccia | Salvia | `#2f6b4f` | Accento del design system |
| Interfaccia | Inchiostro | `#111827` | Testi principali |
| Interfaccia | Grigio fondo | `#f4f5f7` | Superfici di base |

- **Sora SemiBold 600** per il wordmark.
- **Poppins** per l’interfaccia applicativa.
- La menta appartiene al marchio: non sostituisce automaticamente il salvia nei pulsanti o negli stati dell’interfaccia.

### Uso del marchio

Il kit include versioni **verticale**, **orizzontale**, **solo wordmark** e **mano isolata**, con varianti per fondi scuri, chiari e riproduzioni monocromatiche.

- Utilizzare gli asset completi senza deformare, ruotare o specchiare la mano.
- Non aggiungere al marchio stelline, gradienti, ombre, bagliori o texture.
- Non modificare proporzioni, carattere tipografico o rapporto tra mano e wordmark.
- Conservare almeno **0,5 volte l’altezza visibile della A** di spazio libero intorno al logo; per la mano isolata, almeno il **10% della sua larghezza**.
- Per favicon e avatar utilizzare le esportazioni dedicate, non il logo completo ridotto.

### Risorse del brand-kit

| Risorsa | Percorso |
| --- | --- |
| Guida completa al marchio | [BRAND-GUIDELINES.md](brand-kit/docs/BRAND-GUIDELINES.md) |
| Documentazione del kit | [brand-kit/README.md](brand-kit/README.md) |
| Loghi vettoriali | [brand-kit/assets/brand/svg/](brand-kit/assets/brand/svg/) |
| Loghi raster | [brand-kit/assets/brand/png/](brand-kit/assets/brand/png/) |
| Mano isolata | [brand-kit/assets/brand/marks/](brand-kit/assets/brand/marks/) |
| Palette e token | [tokens.json](brand-kit/assets/brand/tokens.json) · [brand.css](brand-kit/assets/brand/brand.css) |
| Font e relative licenze | [brand-kit/fonts/](brand-kit/fonts/) |
| Favicon e icone | [brand-kit/public/](brand-kit/public/) |
| Materiali social e Open Graph | [brand-kit/marketing/](brand-kit/marketing/) |
| Anteprima del kit | [brand-kit/preview/index.html](brand-kit/preview/index.html) |
| Sorgenti modificabili | [brand-kit/sources/](brand-kit/sources/) |

## Avvio in locale

Il prototipo utilizza ES Modules, `fetch` per JSON/GeoJSON/GLB e un Service Worker. Deve essere servito via HTTP: non aprire le pagine con `file://`.

```bash
git clone https://github.com/spad-0x/fatt-APPost.git
cd fatt-APPost
python3 -m http.server 8000
```

In alternativa, dalla root della repository:

```bash
npx serve .
```

Con il server Python, aprire:

| Pagina | Indirizzo locale |
| --- | --- |
| Presentazione | http://127.0.0.1:8000/presentazione.html |
| Assistente cittadino | http://127.0.0.1:8000/index.html |
| Sala operativa animata | http://127.0.0.1:8000/napolios.html |
| Anteprima brand-kit | http://127.0.0.1:8000/brand-kit/preview/index.html |

Non è richiesta una build per il sito o per le demo. Il brand-kit dispone di script propri, descritti nella [documentazione dedicata](brand-kit/README.md).

## Scenari interattivi

Gli scenari sono definiti in `scenari/*.json`. Gli indirizzi seguenti sono relativi alla root del sito; in locale, anteporre `http://127.0.0.1:8000`.

### Assistente cittadino

| Scenario | Percorso |
| --- | --- |
| Serata a Napoli, flusso completo | `/index.html?scena=s1&autoplay=1` |
| Notifica di un avviso comunale | `/index.html?scena=s2-avviso&autoplay=1` |
| Richieste rapide | `/index.html?scena=q1&autoplay=1`, `q2`, `q3` |
| Scena minima di test | `/index.html?scena=prova&autoplay=1` |

### NapoliOS

| Scenario | Percorso |
| --- | --- |
| Apertura della rete TPL su Napoli 3D | `/napolios.html?scena=apertura` |
| Ingorgo in Via Marina, autonomia A2 | `/napolios.html?scena=l1` |
| Ambulanza con onda verde, autonomia A3 | `/napolios.html?scena=s2` |
| Regolazioni notturne e firma operatore, A2/A4 | `/napolios.html?scena=notte` |
| Visione d’insieme e corridoio illuminato | `/napolios.html?scena=visione` |
| Sola mappa e livelli dati | `/napolios.html?scena=dati&vista=mappa` |

NapoliOS forza `autoplay=1` al caricamento e usa `apertura` quando non è specificato uno scenario. L’animazione rappresenta una simulazione, non il tracciamento di veicoli reali.

### Controlli della timeline

Quando il focus non è in un campo di testo:

| Tasto | Azione |
| --- | --- |
| `Spazio` | Avvia / mette in pausa |
| `→` oppure `N` | Passa al passo successivo |
| `R` | Riavvia lo scenario |
| `1–9` | Seleziona una delle scene disponibili nella pagina |
| `H` | Mostra / nasconde il pannello di regia, dove presente |

La sala operativa non crea il pannello tecnico di regia. Il parametro `regia=0` attiva la modalità ripresa; `velocita=2` raddoppia la velocità della timeline. Su NapoliOS l’avvio automatico non impedisce di mettere successivamente in pausa con `Spazio`.

## Architettura e struttura

Il prototipo è un sito statico con HTML, CSS e JavaScript a moduli. Scenari e dati geografici sono caricati dal browser, senza backend applicativo.

```text
.
├── presentazione.html     # Landing: idea, video e accesso alle demo
├── index.html             # Assistente cittadino / PWA
├── napolios.html          # Sala operativa simulata
├── css/                   # Design token e stili delle interfacce
├── js/
│   ├── engine.js          # Motore deterministico della timeline
│   ├── regia.js           # Caricamento scenari e controlli
│   └── city/              # Renderer 3D e simulazione della mobilità
├── assets/                # Modello 3D, rete TPL, font e icone dell’app
├── geo/                   # Assi, semafori, percorsi e aree di rischio
├── scenari/               # Scenari dimostrativi JSON
├── brand-kit/             # Identità visiva, esportazioni e documentazione
├── manifest.webmanifest   # Manifest della PWA cittadino
├── sw.js                  # Service Worker
└── vercel.json            # Configurazione del deployment statico
```

## Pubblicazione su Vercel

La configurazione `vercel.json` pubblica il progetto come sito statico e instrada `/` verso `presentazione.html`. Le demo restano disponibili separatamente su `/index.html` e `/napolios.html`.

Per aggiornare il progetto esistente, dopo aver effettuato l’accesso e collegato la directory al progetto Vercel corretto:

```bash
npx vercel --prod
```

Usare il dominio di produzione stabile indicato all’inizio del README, non i vecchi URL temporanei o gli URL dei singoli deployment. Le modifiche al README non modificano il comportamento delle demo.

---

**fatt APPost · NapoliOS** — Progetto per **The Big Hack@Futuro remoto**. Fatto per Napoli, fatto per le persone.
