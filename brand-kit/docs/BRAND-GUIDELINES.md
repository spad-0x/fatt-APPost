# Uso del marchio fatt APPost

## Identità

La mano è il ricalco vettoriale della silhouette fornita, senza stellina, inclinazioni aggiuntive o elementi decorativi. Il nome si scrive **fatt APPost**: `fatt ` e `ost` in bianco, `APP` in menta, wordmark Sora SemiBold 600.

Il kit impiega campiture piatte e non aggiunge gradienti, ombre, bagliori o texture. Sullo sfondo verde scuro il marchio resta bianco e menta.

## Varianti

| Variante | Impiego |
| --- | --- |
| `stacked` | Copertine, slide, post, stampa e logo principale |
| `horizontal` | Header, footer, firme grafiche e banner |
| `wordmark` | Spazi molto bassi o contesti in cui la mano è già presente |
| Mano isolata | Avatar, favicon, icone di app e ambienti già riconoscibili |
| `dark` | Tavola con fondo verde compreso |
| `reverse` | Trasparente: bianco/menta, da collocare su verde scuro |
| `on-light` | Trasparente: salvia/inchiostro per bianco e grigio fondo |
| `mono-white`, `mono-sage`, `mono-ink` | Un solo inchiostro, incisione, timbri o vincoli di riproduzione |

Per una stampa in un solo colore, usa un SVG `mono-*`; i colori del kit sono sRGB. Per una stampa con profilo CMYK specifico, il fornitore può convertire i vettoriali con il proprio profilo di produzione.

## Spazio di rispetto

Misura **x** come l’altezza visibile della A nel wordmark. Mantieni almeno **0,5x** liberi intorno all’intero logo. Il padding presente nei master di produzione offre già un margine: non ritagliare fino al bordo visibile quando il logo è vicino ad altri contenuti.

Per la mano isolata, mantieni almeno il 10% della sua larghezza libero intorno al segno. Le icone e gli avatar hanno già il proprio margine e non richiedono un ulteriore ritaglio.

## Centratura

- Verticale: mano larga 650, wordmark largo 960, tavola 1200 × 1200; asse comune X = 600.
- La distanza tra limite inferiore della mano e limite superiore del wordmark è 64 unità.
- L’ingombro verticale complessivo è 526,768 unità, centrato su Y = 600.
- Orizzontale: tavola 1280 × 320; mano larga 280, distanza 64, wordmark largo 760. Entrambi gli elementi sono centrati su Y = 160, e l’ingombro complessivo su X = 640.
- Le metriche si riferiscono ai limiti dei tracciati, non alle scatole em del font.

Non spostare uno solo degli elementi per correggere il padding del contenitore: adatta il contenitore o usa la variante appropriata. La tavola `centering-proof.svg` rende visibili gli assi e i limiti.

## Dimensioni consigliate

| Elemento | Larghezza minima consigliata sullo schermo |
| --- | --- |
| Verticale completo | 180 px |
| Orizzontale completo | 240 px |
| Solo wordmark | 140 px |
| Mano isolata | 24 px; favicon dedicate a 16 e 32 px |

Le soglie sono indicazioni d’uso. Per una favicon usa i file esportati, con il solo simbolo: la scritta completa diventa troppo piccola.

## Icone e ritagli

L’icona standard occupa il 78% della larghezza della tavola. La variante **maskable** e l’avatar occupano il 70%: l’intera sagoma resta dentro il cerchio centrale di diametro 80%, così sopravvive alle maschere circolari e arrotondate.

Riferimento per l’area sicura: [Web Application Manifest — Icon masks and safe zone](https://www.w3.org/TR/appmanifest/#icon-masks).

Usa `icon-512.png` con `purpose: any` e `icon-maskable-512.png` con `purpose: maskable`. Il fondo è opaco e quadrato; il dispositivo applica la propria maschera. L’avatar circolare trasparente è fornito separatamente per gli impieghi che richiedono un ritaglio già pronto.

## Rapporto con DESIGN.md

La combinazione verde scuro/bianco/menta e Sora riguarda il marchio richiesto dall’utente. L’interfaccia mantiene Poppins, il salvia `#2f6b4f`, il fondo `#f4f5f7` e l’inchiostro `#111827` del design system. Il nome del prodotto nel file di riferimento è precedente alla denominazione del marchio usata in questo kit.

La menta evidenzia APP sui fondi scuri. Per i fondi chiari, la variante `on-light` usa il salvia del design system: applicala come file completo, senza ricolorare solo alcune lettere. Il kit non introduce la menta come nuovo colore per pulsanti o stati dell’interfaccia.

## Modifiche da evitare

Non deformare, ruotare o specchiare la mano. Non aggiungere stelline o effetti. Non cambiare il rapporto mano/wordmark nei master. Non sostituire Sora nel marchio. Mantieni APP in maiuscolo e il resto in minuscolo, senza spazi aggiuntivi tra APP e ost. Usa una variante completa del kit per cambiare fondo o passare al monocromatico.
