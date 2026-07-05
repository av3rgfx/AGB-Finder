# Fase 1d — EMENDAMENTO al piano: pivot golden su ARTECH LEGNO

> **Autoritativo** (decisione utente 2026-07-04, Task 0): sostituisce le parti
> del piano `2026-07-04-fase1d-kit-engine.md` indicate sotto. Ogni dispatch di
> task DEVE leggere questo file insieme al brief.

## Motivo

La distinta golden 2021 era «ad applicare» su ALLUMINIO: quella gamma **non
esiste più nel listino 2026** (verificato a DB: 9/20 codici sopravvissuti, gli
11 mancanti sono tutti i pezzi profilo-specifici; nemmeno i prefissi esistono).
Il capitolo ARTECH 2026 è completo per **LEGNO**. Pilota → **ARTECH anta-ribalta
LEGNO**: struttura e quantità restano quelle della distinta reale; i codici
profilo-specifici sono rimappati sugli equivalenti legno 2026.

## Golden test LEGNO (sostituisce GOLDEN_EXPECTED del Task 2)

Input golden: come nel piano ma **`material: "LEGNO"`** (tutto il resto uguale:
550×1820, SX, aria 12, asse/int 13, battuta 20, sede 18, ARGENTO, TIRARE).

**16 righe / 21 pezzi** (✓ = verificato a DB in Task 0):

| # | Posizione | Codice 2026 | Qty | Origine |
|---|---|---|---|---|
| 1 | cremonese | `A50122.15.07` ✓ | 1 | identico 2021; `colonne.hbb="1594-1810"`, `colonne."not."="2"` |
| 2 | movimento-angolare | `A50302.01.02` ✓ | 2 | identico 2021 |
| 3 | chiusura-angolo | `A50330.00.00` ✓ | 1 | identico 2021 |
| 4 | chiusura-terminale | `A50401.00.03` ✓ | 1 | identico 2021 |
| 5 | chiusura-prolunga-200 | `A51801.00.01` ✓ | 1 | identico 2021 |
| 6 | chiusura-prolunga-600 | `A51803.00.03` ✓ | 1 | identico 2021 |
| 7 | forbice-corpo | `A50510.00.02` ✓ | 1 | identico 2021 (Fusto; range in `colonne`) |
| 8 | supporto-forbice | `A50702.05.00` ✓ | 1 | legno «Aria 12 - Interasse 9/13» (config. certificata ift ARTech Legno) |
| 9 | perno-supporto-forbice | `A50790.00.00` ✓ | 1 | identico 2021 |
| 10 | squadra-angolare | `A50904.36.02` ✓ | 1 | legno «INTERASSE 13 SX» (ift legno; DX=`.01`) |
| 11 | supporto-cerniera | **DA ESTRARRE** | 1 | variante legno aria 12/int 13 lato telaio — vedi procedura sotto |
| 12 | coperture-kit | `A51301.02.21` ✓ | 1 | legno «Kit supporto forbice + supporto cerniera … Argento SX» (DX=`.01.21`) |
| 13 | incontro-dss | `A51400.05.03` ✓ | 1 | identico 2021 |
| 14 | incontri-nottolino | `A51400.05.02` ✓ | 5 | legno «Aria 12» (successore di A51401.05.02) |
| 15 | incontro-ribalta | `A51400.05.70` ✓ | 1 | «13x24 viti dritte» (successore di A514SX.05.65; ASSUNZIONE: non più destro/sinistro) |
| 16 | forbice-braccio | `A51912.36.02` ✓ | 1 | legno «Battuta 20 SX», int 13 (`.36`), GR2 (`.02`); DX=`A51911.36.0G` |

**Procedura riga 11 (supporto-cerniera):** cercare a DB
`name ILIKE 'supporto cerniera%'` in sottocategoria `Cerniere - Legno` la
variante aria 12 / interasse 13, suffisso `.02`=SX. Se non esiste variante
aria 12: documentare nel report quale supporto si usa col sistema aria 12
(candidati: famiglia `A50801`/`A50803`; controllare `colonne` per
aria/interasse) e pinnare quel codice nel golden. La scelta va motivata nel
report e in `ruleDescription`.

## Regole di selezione (delta al Task 2)

- **Cremonese**: variante per range `colonne.hbb`. ASSUNZIONE: `hbb = heightMm - 10`
  (golden: 1820−10=1810 ∈ [1594,1810], bordo max incluso). Tabella CREMONESI da
  costruire dalle `colonne.hbb` di `A50122.15.%` (estrarre a DB).
- **Corpo forbice**: range larghezza dalle `colonne` di `A50510.00.%`
  (golden `.02` = 476-604).
- **Braccio**: `A5191{1=DX,2=SX}.{26=int9|36=int13}.{0G}` con gruppo G da
  tabella larghezza (golden GR2 per L=550; estrarre i range gruppo dalle
  `colonne` dei bracci o della forbice).
- **Quantità incontri nottolino**: PRIMA di usare la formula del piano,
  verificare l'ipotesi data-driven: somma di `colonne."not."` dei componenti
  mobili selezionati (cremonese 2 + movimenti 1×2 + forbice 1 = 5 ✓ golden).
  Se i dati `not.` esistono su tutti i componenti coinvolti → usare quella
  (niente formula assunta); altrimenti formula del piano con ASSUNZIONE.
- **Guardia materiale**: `material !== "LEGNO"` → `KitGenerationError`
  («Materiale X non ancora coperto: il generatore supporta LEGNO») — test
  dedicato. `kitInputSchema` resta con enum a 3 materiali (Task 1 invariato).
- Mano: suffissi `.01`=DX / `.02`=SX (squadra, coperture kit, braccio GR
  a parte che usa `.0G` con famiglia DX/SX distinta).

## Delta agli altri task

- **Task 4 (engine.test)**: `validInput.material = "LEGNO"`; attese: **16
  righe**, `totalComponents: 16`, somma pezzi **21** (`totalPrice ≈ 2×21` col
  fake a 2.000); incontri `A51400.05.02` qty 5.
- **Task 5 (router test)**: `validInput.material = "LEGNO"`; il test di
  successo si aspetta 16 righe.
- **Task 7 (wizard)**: default form `material: "LEGNO"`; PVC/ALLUMINIO visibili
  ma con hint «presto disponibile» (la generate fallirebbe con l'errore guard).
- **Task 8 (integrazione)**: input `material: "LEGNO"`, attese 16 righe senza
  warning, tutti i codici prezzati dal listino 2026.
- Test «mano DESTRA» (Task 2): attesi i codici DX: squadra `A50904.36.01`,
  coperture `A51301.01.21`, braccio `A51911.36.02`; righe sempre 16.

## Nota spec

La spec `2026-07-04-fase1d-kit-engine-design.md` resta valida con questo
emendamento; la tabella golden 2021 lì riportata è il documento sorgente
storico (per struttura e quantità), non più l'output atteso letterale.
