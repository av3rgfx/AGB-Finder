# Vasistas ARTECH legno — assunzioni (PROVVISORIO)

**Fase 1i.** Distinta derivata dallo schema di montaggio del listino AGB 2026
(pag. 416, «Finestra rettangolare legno - apertura vasistas»), anta singola,
entrata E.15, variante base. NON validata da un esperto. Golden =
snapshot auto-coerente (`rules-artech-vasistas-legno.test.ts`).

## Distinta pilota (anta singola, E.15, LEGNO)

| Posizione | Codice | Q.tà | Fonte |
|---|---|---|---|
| Cremonese vasistas (maniglia variabile) | `A50111.15.11…16` (per GR) | 1 | Listino E.15, righe ~19552-19558 |
| DSS (ambidestro) | `A50190.00.00` | 1 | NB listino 19565 (A50111 lo richiede a parte) |
| Incontro DSS | `A51400.05.03` | 1 | Condiviso anta-ribalta |
| Forbici per vasistas | `A50545.00.00` | GR1-3→1, GR4-6→2 | NB 19566-19567 |
| Supporto forbice | `A50702.05.00` | = n. forbici | Condiviso anta-ribalta |
| Perno supporto forbice | `A50790.00.00` | = n. forbici | Condiviso anta-ribalta |
| Terminale per vasistas | `A50193.00.03` | 1 | Schema pos.3 (corsa 18) |
| Movimento angolare | `A50302.01.02` | 2 | Condiviso anta-ribalta |
| Limitatore di corsa 18 | `A50196.00.18` | 2 | Schema pos.6 |
| Incontri nottolino | `A51400.05.02` | NOT.(GR) | Colonna NOT. tabella A50111.15 |

**Campo di applicazione:** GR01–GR06 (HBB 540–2510), superficie ≤ 2 m².
GR per altezza: GR01 540–712 · GR02 660–860 · GR03 820–1220 · GR04 1190–1610 ·
GR05 1590–2010 · GR06 1890–2510 (bordi sovrapposti → GR più basso). NOT.(GR):
GR01=0, GR02=1, GR03=1, GR04=2, GR05=2, GR06=4.

## Domande per l'agente (sblocco validazione)

1. **Offset altezza→HBB**: HBB = heightMm (offset 0) o −10 come l'anta-ribalta?
2. **DSS**: incluso `A50190.00.00` + incontro `A51400.05.03`? Variante per mano
   (`A50190.00.DX/.SX`) vs ambidestro?
3. **Movimento angolare**: quantità 2 (come i gemelli)? Di conseguenza il limitatore
   `A50196.00.18` (assunto = n. movimenti).
4. **Terminale per vasistas**: quale/quante posizioni — corsa 18 (`A50193.00.03`) vs
   18+18 (`A50193.00.02`)?
5. **Incontri nottolino**: colonna NOT.(GR) o formula perimetrale «2 + scatti passo 600»?
6. **Forbici**: le bande LBB «Posizionamento forbici» determinano solo la posizione o
   anche il numero? Obbligo montanti per LBB 861-2510/HBB>500 come warning?
7. **Supporto forbice**: battuta 18 (`A50701.05.00`) o 20 (`A50702.05.00`)?
8. **Coperture/finitura**: serve un kit copertura estetico? Oggi `finish` non è usato.
9. **Incontro ribalta `A51400.05.70`**: serve nel vasistas base o bastano forbici +
   limitatore?
10. **GR00** (HBB 274–662, escluso dal pilota): quante forbici? Sblocca le finestre
    piccole.
