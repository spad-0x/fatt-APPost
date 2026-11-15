---
name: FattoAPPosta
description: "Assistente tascabile per le cose di ogni giorno: neutri freddi, un solo accento salvia, una mascotte che reagisce."
colors:
  ground: "#f4f5f7"
  desk: "#e6e8ec"
  surface: "#ffffff"
  surface-press: "#eceef1"
  line: "#e1e4e8"
  line-strong: "#c9ced6"
  ink: "#111827"
  ink-2: "#5f6672"
  accent: "#2f6b4f"
  accent-press: "#255a41"
  accent-shade: "#24563f"
  accent-soft: "#e3ede7"
  accent-wave: "#9dbcaa"
  danger: "#b42318"
typography:
  display:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(1.875rem, 0.9rem + 5.6vw, 2.375rem)"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
  lead:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
  control:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  input:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  body:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-read:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  label-strong:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  small:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  field: "14px"
  bubble: "20px"
  sheet: "28px"
  frame: "40px"
  pill: "999px"
  circle: "50%"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "20px"
  s-6: "24px"
components:
  cta-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.lead}"
    rounded: "{rounded.pill}"
    height: "60px"
    width: "100%"
  cta-pill-active:
    backgroundColor: "{colors.surface-press}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "52px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "#1f2937"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "52px"
    width: "100%"
  button-secondary-active:
    backgroundColor: "{colors.surface-press}"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "44px"
  icon-button-active:
    backgroundColor: "{colors.surface-press}"
  icon-button-flat:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "44px"
  bookmark-saved:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.circle}"
    size: "44px"
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "28px 28px 0 0"
    padding: "24px 20px 20px"
  segmented-control:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-tab:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
  segmented-tab-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  field-input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.field}"
    height: "50px"
    padding: "0 16px"
  field-input-focus:
    backgroundColor: "{colors.surface}"
  field-input-error:
    backgroundColor: "{colors.surface}"
  field-error:
    textColor: "{colors.danger}"
    typography: "{typography.small}"
  speech-bubble:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.lead}"
    rounded: "18px"
    padding: "10px 18px"
  mascot:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.circle}"
    width: "min(76vw, 300px)"
  avatar:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.circle}"
    size: "36px"
  message-user:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "20px 20px 6px 20px"
    padding: "12px 16px"
  message-assistant:
    textColor: "{colors.ink}"
    typography: "{typography.body-read}"
  voice-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px 8px 8px"
    width: "min(82%, 280px)"
  voice-play:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "40px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  chip-active:
    backgroundColor: "{colors.accent-soft}"
  attachment-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "4px 4px 4px 12px"
  composer-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 16px 0 6px"
  credits-token:
    textColor: "{colors.accent}"
    typography: "{typography.label-strong}"
  action-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.circle}"
    size: "56px"
  action-button-hover:
    backgroundColor: "{colors.accent-press}"
  action-button-recording:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "16px"
    padding: "10px 16px"
---

# Design System: FattoAPPosta

## Overview

**Creative North Star: "L'assistente quieto"**

FattoAPPosta è lo standard di categoria delle app di chat eseguito senza ironia: fondo grigio freddo quasi bianco, superfici bianche, inchiostro quasi nero e un solo accento verde salvia. L'identità non arriva dagli effetti ma da un unico personaggio, la mascotte: una sfera salvia opaca con un solo tono d'ombra e due occhi triangolari bianchi, che reagisce a ciò che l'utente sta facendo e poi diventa l'avatar dell'assistente in chat. Tutto il resto si fa da parte.

La densità è quella di un'app di messaggistica nativa: una colonna mobile, controlli a pillola e a cerchio, testo a 15px con interlinea generosa, target di tocco da 44px. La profondità è costruita con una sola ombra morbida con offset e con il passaggio tonale tra fondo grigio e superfici bianche, mai con bordi pesanti. Il movimento è rapido e funzionale (150–250ms per i cambi di stato dell'interfaccia); solo la mascotte ha un movimento di carattere, e anche quello si spegne con `prefers-reduced-motion`.

Il mondo rifiuta in modo esplicito il default "AI" della categoria: l'orb sfumato viola con glow, il dark-glass viola/ciano/rosa, i gradienti aurora e il testo in gradiente. L'asticella di finitura sono Messaggi di Apple (iOS) e le app ChatGPT / Claude.

**Key Characteristics:**
- Neutri freddi più un unico accento salvia; il rosso compare solo come stato (errore, registrazione).
- Poppins self-hosted in tre pesi (400/500/600), titoli a peso 500, mai grassetto pesante.
- Pillole bianche e cerchi bianchi da 44px con una sola ombra morbida; campi a riempimento tonale.
- Mascotte reattiva come unico segno distintivo, ripresa in miniatura come avatar della chat.
- Movimento di interfaccia 150–250ms con easing in uscita; nessun effetto decorativo in loop.
- Mobile-first a colonna singola; su desktop l'app vive in una cornice da 400px.

## Colors

Una palette trattenuta: neutri freddi a bassa saturazione e un solo accento verde salvia, usato come segnale e mai come campitura di superficie.

### Primary
- **Salvia Profonda** (#2f6b4f): l'unica voce cromatica. Compare sulla parola "fatto apposta" del titolo, sul pulsante microfono/invio, sul gettone dei crediti, sul segnalibro salvato, sulle barre già riprodotte della nota vocale, sull'anello di focus, sul cursore di testo e sul corpo della mascotte. Contrasto 5.77:1 sul fondo e 6.29:1 sul bianco; bianco su salvia 6.29:1.
- **Salvia Premuta** (#255a41): hover del pulsante d'azione. Bianco su questo tono 8.02:1.
- **Salvia d'Ombra** (#24563f): l'unico tono d'ombra della mascotte e degli avatar, applicato come mezzaluna in basso a destra della sfera. Non si usa nell'interfaccia.
- **Salvia Velata** (#e3ede7): selezione del testo e stato premuto dei chip di suggerimento. Inchiostro su questo tono 14.81:1.
- **Salvia d'Onda** (#9dbcaa): barre della forma d'onda non ancora riprodotte. Solo 2.06:1 sul bianco: è un segno decorativo (`aria-hidden`), il progresso è comunicato dal conto alla rovescia della durata e dall'etichetta del pulsante.

### Tertiary
- **Rosso di Stato** (#b42318): errori dei campi (bordo e messaggio), pulsante d'azione in registrazione con il suo anello pulsante, testo "Sto ascoltando · 0:01" nel composer disabilitato. 6.57:1 sul bianco, 6.03:1 sul fondo; bianco su rosso 6.57:1.

### Neutral
- **Grigio Fondo** (#f4f5f7): fondo dell'app, dei campi a riposo, del controllo segmentato, del pulsante play della nota vocale e del dock della chat. È anche `theme-color` e `background_color` del manifest.
- **Grigio Scrivania** (#e6e8ec): solo su desktop, il fondo dietro la cornice dell'app.
- **Bianco Superficie** (#ffffff): pillole, cerchi, bolle utente, foglio di accesso, fumetto della mascotte, campi a fuoco o in errore.
- **Bianco Premuto** (#eceef1): stato `:active` di CTA, pulsante secondario e pulsanti a cerchio.
- **Filo** (#e1e4e8): hairline dei chip, del pulsante secondario, del divisore "oppure" e dei campi in hover (1.28:1 sul bianco: un filo, non un confine).
- **Filo Marcato** (#c9ced6): hover del pulsante secondario e dei chip, colore della scrollbar. Oggi è un valore scritto a mano in `styles.css`, non una custom property.
- **Inchiostro** (#111827): testo principale (16.26:1 sul fondo, 17.74:1 sul bianco), pulsante primario e toast.
- **Inchiostro Secondario** (#5f6672): testo secondario, placeholder, orari, stato utente, icone a riposo nel composer, puntini di digitazione (5.30:1 sul fondo, 5.78:1 sul bianco, 4.98:1 sul bianco premuto).

### Named Rules
**La Regola dell'Unica Voce.** Il salvia è l'unico accento. Non si aggiunge un secondo colore di marca, né una variante "secondaria"; ogni nuovo segnale positivo usa il salvia, ogni segnale di errore o registrazione usa il rosso di stato.

**La Regola del Rosso di Stato.** Il rosso esiste solo mentre c'è uno stato da comunicare (errore, registrazione in corso) e sparisce appena lo stato finisce. Non si usa mai come decorazione o enfasi.

**La Regola del Testo Leggibile.** Ogni testo resta sopra 4.5:1. Il salvia d'onda e i fili non portano mai informazione da soli.

## Typography

**Display Font:** Poppins (con system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Poppins (stessa pila)

**Character:** una geometrica amichevole, self-hosted in tre pesi (400, 500, 600) e due sottoinsiemi (latin, latin-ext), con `font-display: swap`. I titoli usano il peso 500 con tracking leggermente negativo: la gerarchia nasce dalla dimensione, non dal grassetto. I numeri sono tabellari in tutta l'app.

### Hierarchy
- **Display** (500, clamp 30–38px, 1.18, -0.02em): solo il titolo dell'onboarding, tre righe centrate con `text-wrap: balance`; la seconda riga è in salvia.
- **Headline** (500, 22px, 1.25, -0.015em): titolo del foglio di accesso. Scende a 20px sotto i 700px di altezza.
- **Title** (500, 18px, 1.3): titolo della conversazione nell'header, una riga con ellissi.
- **Lead** (500, 17px): testo della CTA "Inizia ora" e del fumetto della mascotte.
- **Control** (500, 16px): pulsanti primario e secondario del foglio.
- **Input** (400, 16px): campi del foglio e del composer. 16px è il minimo per evitare lo zoom automatico su iOS.
- **Body** (400, 15px, 1.5): corpo base e bolle utente.
- **Body Read** (400, 15px, 1.6): risposte dell'assistente e sottotitolo dell'onboarding (`max-width: 30ch`), con `text-wrap: pretty`.
- **Label** (500, 13px): etichette dei campi, tab del controllo segmentato, chip, toast.
- **Label Strong** (600, 13px): nome "FattoAPPosta" sopra le risposte e numero dei crediti. È l'unico uso del peso 600.
- **Small** (400, 13px, 1.4): messaggi d'errore dei campi, sottotitolo del foglio, chip allegato, stato "Ti ascolto…".
- **Micro** (400, 12px, 1.4): orari, stato utente nell'header, nota "Il profilo resta solo su questo dispositivo.", divisore "oppure", durata della nota vocale.

### Named Rules
**La Regola dei Tre Pesi.** Solo 400, 500 e 600. Il 600 è riservato a nome dell'assistente e crediti; nessun 700.

**La Regola dei 16px nei Campi.** Ogni campo di testo è a 16px (1rem), anche dove il corpo è a 15px.

## Layout

Una sola colonna mobile-first alta `100dvh`, con le aree sicure rispettate tramite `env(safe-area-inset-*)`. Ogni vista ha padding laterale di 20px (`s-5`) e verticale di 16px (`s-4`) più l'area sicura. La spaziatura segue una base 4 (4, 8, 12, 16, 20, 24px).

- **Onboarding:** titolo centrato con margine superiore `clamp(24px, 6dvh, 56px)`; palco della mascotte che occupa lo spazio libero (mascotte larga `min(76vw, 300px)`); piede con sottotitolo e CTA a tutta larghezza separati da 24px. Quando il foglio si apre, titolo e piede escono (opacità e 12px di traslazione) e la mascotte viene scalata e spostata via JS nello spazio libero sopra il foglio.
- **Foglio di accesso:** ancorato in basso, altezza massima `100% - 132px`, scorrimento interno con `overscroll-behavior: contain`; ordine: titolo + chiudi, sottotitolo, controllo segmentato, campi (12px tra un campo e l'altro, 6px tra etichetta e campo), pulsante primario, nota locale, divisore, pulsante secondario.
- **Chat:** header a griglia 44px / 1fr / 44px con 12px di gap; flusso dei messaggi con gap di 16px, ancorato in basso (`margin-top: auto` sul primo), con dissolvenza di 18px sul bordo superiore. Messaggi consecutivi dello stesso mittente si avvicinano a 4px. Bolle utente fino all'82% della larghezza, risposte dell'assistente fino al 92%. Dock inferiore su fondo grigio con chip a scorrimento orizzontale che sbordano fino ai margini, eventuale chip allegato e composer (pillola + pulsante d'azione, gap 12px).
- **Desktop** (`min-width: 640px` e `min-height: 700px`): il corpo diventa Grigio Scrivania e l'app si chiude in una cornice di 400px di larghezza, alta `min(860px, 100dvh - 48px)`, angoli da 40px e ombra sollevata.
- **Schermi bassi** (`max-height: 700px`): mascotte a `min(58vw, 210px)`, foglio fino a `100% - 72px` con padding ridotto a 16px, titolo del foglio a 20px, sottotitolo del foglio nascosto, spaziature tra campi ridotte a 8px, campi da 46px e pulsanti da 48px.

### Named Rules
**La Regola dei 44px.** Ogni controllo toccabile misura almeno 44×44px (`--hit`); fanno eccezione solo il pulsante di rimozione allegato (32px) e il play della nota vocale (40px), entrambi dentro una superficie più grande.

**La Regola della Cornice.** Il layout si disegna per il telefono; il desktop non riceve un layout diverso, riceve una cornice.

## Elevation & Depth

Sistema ibrido e sobrio: la profondità nasce dal passaggio tonale tra Grigio Fondo e Bianco Superficie e da una sola famiglia di ombre morbide, con offset verso il basso e colore inchiostro a bassa opacità. Le ombre non sono mai colorate né luminose. I contorni, dove servono, sono hairline interne (`inset`) da 1–1.5px.

### Shadow Vocabulary
- **Morbida** (`box-shadow: 0 6px 18px -6px rgb(17 24 39 / 0.14), 0 1px 2px rgb(17 24 39 / 0.05)`): CTA, pulsanti a cerchio dell'header, composer, pulsante d'azione, fumetto, toast.
- **Sollevata** (`box-shadow: 0 14px 34px -12px rgb(17 24 39 / 0.22), 0 2px 4px rgb(17 24 39 / 0.05)`): hover della CTA e cornice desktop.
- **Foglio** (`box-shadow: 0 -10px 30px -12px rgb(17 24 39 / 0.18)`): bordo superiore del foglio di accesso, proiettata verso l'alto.
- **Cursore segmentato** (`box-shadow: 0 2px 6px -1px rgb(17 24 39 / 0.12)`): il "pollice" bianco del controllo segmentato.
- **Appoggio bolla** (`box-shadow: 0 1px 2px rgb(17 24 39 / 0.04)`): bolle utente e note vocali, appena staccate dal fondo.
- **Ombra di contatto**: ellisse `rgb(17 24 39 / 0.16)` sfocata di 9px sotto la mascotte. È profondità, non alone.
- **Velo**: scrim del foglio `rgb(17 24 39 / 0.08)`, appena percettibile.

### Named Rules
**La Regola Ombra-o-Filo.** A riposo una superficie ha un'ombra oppure un filo interno, mai entrambi. L'unica combinazione ammessa è lo stato di focus del composer (ombra morbida più anello salvia interno da 1.5px).

**La Regola dell'Ombra di Contatto.** La mascotte poggia su un'ombra neutra; non riceve mai un alone, un bagliore o un riflesso.

## Shapes

Linguaggio a pillola e cerchio. Tutto ciò che si preme è una pillola (`999px`) o un cerchio; i campi di testo sono rettangoli morbidi da 14px; le bolle utente hanno raggio 20px con l'angolo inferiore destro stretto a 6px come coda, applicato solo all'ultima bolla di un gruppo. Il foglio ha angoli superiori da 28px, la cornice desktop 40px. Il fumetto della mascotte (18px) ha una coda ruotata di 45° verso la mascotte; il toast ha raggio 16px; i chip file dentro le bolle 10px.

Le icone sono un solo set SVG inline a tratto 2px con terminali e giunzioni arrotondati, 22px di default (16px nei chip, 18px nel play e nei crediti, 24px nel pulsante d'azione). La mascotte è geometria pura: un cerchio, una mezzaluna d'ombra mascherata, due triangoli bianchi con giunzioni arrotondate.

### Named Rules
**La Regola Pillola-Cerchio.** I controlli sono pillole o cerchi; il rettangolo arrotondato da 14px è riservato ai campi di inserimento.

## Components

### Mascotte
Sfera salvia opaca con mezzaluna di Salvia d'Ombra e due occhi triangolari bianchi; è un pulsante (tocco = rimbalzo e nuovo saluto: "Ciao!", "Eccomi!", "Dimmi tutto", "Pronto?").
- **Stati usati:** `idle` (respiro di 3.2s, ammiccamento casuale ogni 2.6–5.2s, occhi che seguono il puntatore fino a 12 unità), `curious` (guarda il campo attivo e segue la lunghezza del testo), `shy` (occhi chiusi ad arco sulla password nascosta), `happy` (occhi schiacciati, su apertura del foglio, accesso e tocco).
- **Ingresso:** atterraggio con schiacciamento in 620ms, unico momento coreografato; rimbalzo al tocco 420ms.
- **Avatar in chat:** miniatura da 36px in tre umori: neutro (risposte), pensieroso con occhi alzati (digitazione), in ascolto con occhi tondi (registrazione).

### Fumetto
Pillola bianca da 18px con ombra morbida e coda ruotata, testo Lead; in alto a sinistra della mascotte, annunciato con `aria-live`. Scompare quando il foglio è aperto.

### Buttons
- **Shape:** pillola piena (999px).
- **CTA dell'onboarding:** pillola bianca alta 60px a tutta larghezza, testo Lead e freccia; hover: ombra sollevata e freccia spostata di 3px; premuto: scala 0.98 e Bianco Premuto.
- **Primario:** pillola Inchiostro alta 52px con testo bianco (17.74:1); hover #1f2937 (14.68:1); premuto scala 0.985.
- **Secondario ("Continua come Guest"):** pillola bianca con filo interno di 1.5px; hover filo marcato; premuto scala 0.985 e Bianco Premuto. Ha lo stesso peso visivo del login, per principio di prodotto.
- **Cerchi dell'header:** cerchi bianchi da 44px con ombra morbida, icona Inchiostro; premuto scala 0.94. Variante piatta (chiudi del foglio) su Grigio Fondo senza ombra.
- **Segnalibro:** cerchio dell'header; salvato = icona riempita e tracciata in salvia, con toast di conferma.
- **Focus:** contorno salvia di 2px con offset di 3px su tutto (`:focus-visible`), 6px sulla mascotte, interno (-2px) nei controlli incassati.

### Foglio di accesso
Foglio bianco dal basso con angoli superiori da 28px, `role="dialog"` modale con trappola del focus, ESC e clic sul velo per chiudere; il focus va alla tab selezionata all'apertura e torna al pulsante d'origine alla chiusura. Apertura: foglio 240ms + velo 200ms in uscita; chiusura 200ms + 180ms in entrata.

### Controllo segmentato
Binario Grigio Fondo a pillola con padding 4px e un pollice bianco che scorre in 180ms; tab da 40px con testo Label, Inchiostro Secondario a riposo e Inchiostro se selezionata. Frecce, Home e Fine cambiano modalità. In "Registrati" il campo Nome si apre con una transizione di righe della griglia (180ms).

### Inputs / Fields
- **Style:** riempimento Grigio Fondo, bordo trasparente da 1.5px, raggio 14px, altezza 50px, testo a 16px, cursore salvia, etichetta Label sopra (6px).
- **Hover:** il bordo diventa Filo.
- **Focus:** bordo salvia e fondo bianco, senza anello esterno.
- **Errore:** bordo Rosso di Stato e fondo bianco, messaggio Small rosso sotto il campo (vuoto = nascosto), `aria-invalid` sul campo e annuncio in un'area `role="alert"`; l'errore si cancella alla prima digitazione.
- **Password:** pulsante occhio da 44px dentro il campo, a destra, con `aria-pressed`.

### Messaggi
- **Bolla utente:** bianca, raggio 20px con coda da 6px, padding 12×16px, appoggio bolla; a destra.
- **Risposta dell'assistente:** nessuna bolla. Riga meta con avatar 36px, orario Micro e nome Label Strong, poi testo libero Body Read. È la differenza visiva principale tra i due interlocutori.
- **Allegato inviato:** chip file da 10px su Grigio Fondo dentro la bolla utente.
- **Nota vocale:** pillola bianca larga `min(82%, 280px)` con play circolare da 40px su Grigio Fondo, 30 barre da 3px (Salvia d'Onda, Salvia Profonda quando riprodotte, cambio colore 120ms lineare) e durata Micro che conta alla rovescia.
- **Riga di digitazione:** avatar pensieroso più tre puntini da 7px in Inchiostro Secondario che salgono di 3px in sequenza (ciclo 1s).
- **Riga di ascolto:** avatar in ascolto più "Ti ascolto…" in Small Inchiostro Secondario.

### Chips
- **Suggerimenti:** pillole bianche da 40px con filo interno da 1px e testo Label, in una fascia orizzontale scorrevole con snap; hover filo marcato, premuto Salvia Velata.
- **Allegato in attesa:** pillola bianca con filo, icona file 16px, nome con ellissi e pulsante di rimozione circolare da 32px.

### Composer
Pillola bianca alta 56px con ombra morbida: graffetta (cerchio 44px, Inchiostro Secondario, hover Inchiostro su Grigio Fondo), campo a 16px senza bordo, gettone crediti a destra. A fuoco aggiunge un anello salvia interno da 1.5px. Durante la registrazione il campo è disabilitato e mostra "Sto ascoltando · m:ss" in rosso.
- **Gettone crediti:** icona a disco con anello interno 18px più numero in Label Strong, tutto in salvia; a ogni consumo il gettone ruota su sé stesso in 360ms.
- **Pulsante d'azione:** cerchio salvia da 56px separato dalla pillola, icona bianca 24px; microfono a campo vuoto, freccia di invio con testo. Hover Salvia Premuta, premuto scala 0.94. In registrazione diventa rosso con icona stop e un anello rosso da 2px che si espande a 1.45× e svanisce (ciclo 1.4s).

### Toast
Pillola Inchiostro con testo bianco Label, raggio 16px, ombra morbida, centrata sopra il composer (sulla fascia dei chip); entra con opacità e 8px di traslazione in 200ms, resta 2.4s, `role="status"`.

### Movimento
- **Interfaccia:** 150ms (`--t-fast`) per colore, ombra e scala al tocco; 200ms (`--t-base`) per toast e frecce; 240ms (`--t-sheet`) per foglio e palco della mascotte; 180ms per pollice segmentato e apertura del campo Nome. Cambi di vista: uscita 160ms in `cubic-bezier(0.4, 0, 1, 1)`, entrata 220–240ms in `cubic-bezier(0.16, 1, 0.3, 1)` con 8–10px di traslazione.
- **Fuori dalla fascia 150–250ms, per scelta:** il movimento di carattere della mascotte (ingresso 620ms, rimbalzo 420ms, respiro 3.2s, occhi 90ms, sguardo 180ms), il giro del gettone (360ms) e i cicli di stato (digitazione 1s, registrazione 1.4s).
- **Movimento ridotto:** con `prefers-reduced-motion: reduce` ogni animazione e transizione CSS dura 1ms con una sola iterazione e lo scroll diventa istantaneo; in JS respiro, rimbalzo, ingresso e giro del gettone non partono, i cambi di vista durano 1ms e la risposta simulata arriva in 300ms.

### Named Rules
**La Regola della Mascotte Reattiva.** La mascotte si muove per rispondere a qualcosa (puntatore, campo, password, tocco, digitazione, registrazione); l'unico movimento spontaneo è il respiro di 3.2s.

**La Regola dei 150–250ms.** Ogni transizione di stato dell'interfaccia sta fra 150 e 250ms con easing in uscita; più lento è riservato alla mascotte e ai cicli che indicano uno stato in corso.

## Do's and Don'ts

### Do:
- **Do** usare il salvia (#2f6b4f) solo come segnale: parola del titolo, azione principale della chat, crediti, segnalibro salvato, onda riprodotta, focus.
- **Do** costruire le superfici come pillole o cerchi bianchi su Grigio Fondo con la sola ombra morbida (`0 6px 18px -6px rgb(17 24 39 / 0.14), 0 1px 2px rgb(17 24 39 / 0.05)`).
- **Do** lasciare le risposte dell'assistente in testo libero sotto avatar, orario e nome; le bolle sono solo dell'utente.
- **Do** mantenere ogni controllo toccabile a 44px e ogni campo di testo a 16px.
- **Do** dare a ogni stato interattivo un `:focus-visible` salvia da 2px e un `:active` (scala 0.94–0.985 o Bianco Premuto).
- **Do** tenere le transizioni di interfaccia fra 150 e 250ms e rispettare `prefers-reduced-motion` sia in CSS sia in JS.
- **Do** far reagire la mascotte allo stato e riusarla come avatar, invece di aggiungere illustrazioni nuove.

### Don't:
- **Don't** usare dark-glass viola/ciano/rosa, gradienti aurora, testo in gradiente o glow decorativi; l'unico gradiente ammesso è la maschera di dissolvenza di 18px in cima al flusso dei messaggi, l'unica sfocatura è l'ombra di contatto neutra della mascotte.
- **Don't** usare Syne, Outfit, Space Grotesk o Inter; il carattere è Poppins self-hosted.
- **Don't** introdurre un secondo accento cromatico o usare il rosso per enfasi: il rosso è solo errore e registrazione.
- **Don't** mettere ombra e filo sulla stessa superficie a riposo.
- **Don't** trasformare la mascotte in una sfera luminosa, sfumata o lucida: resta opaca, con un solo tono d'ombra.
- **Don't** affidare un'informazione solo al Salvia d'Onda (#9dbcaa) o ai fili (#e1e4e8, #c9ced6): non hanno contrasto sufficiente per farlo.
- **Don't** usare pesi oltre 600 né caricare font da CDN: l'app deve funzionare offline.
