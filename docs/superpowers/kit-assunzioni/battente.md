# Anta a battente ARTECH LEGNO — esito della verifica: NON DISPONIBILE

> **Stato: DISATTIVATO il 2026-07-25.** Modulo
> `src/server/kit/rules-artech-battente-legno.ts` (engine `artech-batt-legno`) →
> `generate()` **rifiuta** nominando il dato mancante; `KitTemplate` «ARTECH anta a
> battente legno» seedato **`isActive:false`**; la tipologia è tolta da
> `ACTIVE_WINDOW_TYPES` nel wizard (radio disabilitata con la spiegazione).
> Si riattiva con la risposta alla **domanda 1**: è l'unica cosa che manca.

**Pagine**: sempre **fisica (stampata)**, fisica = stampata + 2. Es. `p0416 (414)`.

La tipologia era stata costruita in Fase 1h **sottraendo il meccanismo di ribalta**
dall'anta-ribalta. La verifica contro lo schema di montaggio reale ha mostrato che la
sottrazione toglieva troppo.

---

## Perché è stata spenta

Lo schema **p0416 (414)** «Finestra rettangolare legno - anta singola, apertura a
battente» elenca **21 voci**; il modulo ne generava **5**. Mancavano in particolare:

- voce 5 — «Cerniere per seconda anta › **Corpo articolazione superiore**»
- voce 6 — «Cerniere per seconda anta › **Articolazione superiore anta semifissa**»
- voci 8-9 — «**Supporti forbice**» + «**Perno** per supporto forbice»

cioè l'intero appoggio della cerniera **superiore**: **l'anta non aveva alcun punto di
sospensione in alto**. Non è una distinta incompleta, è una distinta **non montabile** —
e quindi non ordinabile.

Distinta che il modulo generava (per memoria, 5 righe): cremonese `A50200.15.NN` per
altezza · squadra angolare `A50904.36.01/.02` · supporto cerniera (oggi
`A50805.05.DX/.SX`, vedi `legno.md`) · movimento angolare `A50302.01.02` ×2 · incontri
nottolino `A51400.05.02` con la formula perimetrale.

## Perché non era correggibile dal solo listino

Lo schema p0416 (414) è **COMPOSITO**: nello stesso disegno convivono

- la cremonese **a battente** mod. 502 (voce 1),
- voci che appartengono all'**anta-ribalta** (voce 2 cremonese A/R, voce 3 DSS, voce 13
  incontro ribalta),
- e **tre alternative di cerniera**: «per seconda anta» (voci 5-6), «centrali a scomparsa»
  (15-16), «centrale registrabile portante» (17).

Dal solo listino **non è decidibile** quale terna appartenga alla configurazione «anta
singola a battente». Sceglierne una a caso avrebbe rimesso in produzione lo stesso tipo di
errore, solo meglio nascosto.

## Cosa è VERIFICATO e non va rifatto

`BATTENTE_CREMONESI` resta nel modulo (esportata, coperta da test) perché è **corretta**:
le **10 bande HBB** e i codici `A50200.15.01 → .10` coincidono **esattamente** con
**p0429 (427)**, tabella «Cremonesi · Anta a battente - Mod. 502 per finestra e porta
finestra a 1 anta», entrata 15. La famiglia è confermata dalla legenda dello schema
(«Anta a bandiera - mod. 502»). La colonna NOT. del listino vale 2/2/2/3/3/3/3/4/4/4.

È il punto di ripartenza quando arriva la risposta.

---

## Domanda 1 (unica bloccante) — quale terna di cerniere?

Nello schema p0416 (414), per la configurazione **«anta singola a battente»** (legno,
aria 12 / interasse 13 / battuta 20), quale terna di cerniere si monta:

- **A** — «Cerniere per seconda anta» (voci 5-6: corpo articolazione superiore +
  articolazione superiore anta semifissa), con supporti forbice ⑧ e perno ⑨;
- **B** — «Cerniere centrali a scomparsa» (voci 15-16);
- **C** — «Cerniera centrale registrabile portante» (voce 17)?

E, di conseguenza: **quali delle 21 voci dello schema appartengono a questa
configurazione** e quali sono lì per le altre (anta doppia, semifissa, anta-ribalta)?

Ideale: **una distinta reale di esempio** per un battente (input → componenti attesi), come
quella del 2021 per il legno anta-ribalta.

---

## Da chiarire alla riattivazione (non bloccanti oggi, la tipologia è spenta)

- **Incontri della cremonese Mod. 502**: a listino `A52099.25.NN` risulta 124-244 € —
  sono strike standard o set/dime? Il modulo riusava gli incontri dell'anta-ribalta.
- **Quantità degli incontri**: la formula perimetrale dell'anta-ribalta vale anche qui, o
  cambia il numero di punti di chiusura? (è la **domanda 3**, vedi `legno.md`)
- **Offset altezza → HBB** per la Mod. 502: 0 o −10? (è la **domanda 10**, vedi `legno.md`)
- **Coperture** (`A51301.*`, kit «supporto forbice + cerniera»): servono su un battente,
  che la forbice non ce l'ha? Esiste una copertura solo-cerniera?
- **Cerniere condivise**: squadra `A50904.36.*` e supporto cerniera `A50805.05.*` valgono
  identiche per il battente (sono la **domanda 2** per la squadra)?
