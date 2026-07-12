# Kit ARTECH anta-ribalta PVC — assunzioni per revisione esperto

⚠️ **PROVVISORIO.** Modulo `src/server/kit/rules-artech-pvc.ts` (engine `artech-ar-pvc`).
Dati ricavati SOLO dal listino AGB 2026 (`scratchpad/listino.txt`), **non validati**.
Obiettivo di questa scheda: farti validare/correggere rapidamente ogni slot.

## Sintesi della strategia
Nel listino 2026 **non esiste uno schema di composizione ARTECH anta-ribalta PVC
dedicato**: tutti i capitoli di composizione ARTECH sono "legno", e gli incontri
PVC rimandano a un **"listino PVC e ALLUMINIO" separato** (non disponibile qui):

> righe ~36583-36610: *"Nottolino per PVC / Antieffrazione per PVC / DSS per PVC —
> vedi sezione FERRAMENTA PER FINESTRE ARTECH del listino PVC e ALLUMINIO"*

L'unica fonte PVC in questo listino è la **tabella di certificazione ift EN 13126-8**
(righe 604-627, copia a 17187-17209). Gli schemi **8 e 9** sono etichettati
**"ARTech PVC"** (righe 625 e 627) e danno 4 componenti material-specific.

Perciò: **struttura = modulo LEGNO** + **4 swap PVC dalla cert ift**; il resto è
riusato dal legno con marca `ASSUNZIONE: condiviso col legno`.

## Mappatura colonne cert ift → slot (DE → IT)
| Colonna DE (riga 599-600) | Slot IT | Codice PVC (schema 8/9, riga 625) |
|---|---|---|
| Winkelband / top stay connecting part | braccio forbice | `A51921.36.04` |
| Scherenlager / stay arm support | supporto forbice | `A50712.00.00` |
| Eckband / corner hinge (FRM) | squadra angolare | `A50922.07.00` |
| Ecklager / corner pivot (MAS) | supporto cerniera | `A50812.07.00` |

(Confronto legno, schema 1 riga 605: Winkelband `A51911.36.04`, Scherenlager
`A50702.05.00`, Eckband `A50904.36.01`, Ecklager `A50805.05 DX`.)

## Tabella slot-per-slot
Legenda stato: **CERT** = dalla cert ift · **COND** = assunto condiviso col legno ·
**AN** = assunzione/derivazione da confermare.

| Slot | Codice usato | Banda | Fonte (riga) | Stato |
|---|---|---|---|---|
| cremonese | `A50122.15.02..10` per altezza (hbb=H-10) | 650÷2510 (per gruppo) | 19452-19461 | COND (cremonese = altezza maniglia, profilo-agnostica) |
| forbice-corpo (fusto) | `A50510.00.01..05` per larghezza | 277÷1204 | 20036-20040; nota 20134 "fusto forbice **standard** A50510.00.xx" | COND (dichiarato "standard", quasi-certo condiviso) |
| forbice-braccio | `A519{21=DX,22=SX}.36.0N` per larghezza | 277÷1204 (01..04) | cert 625 (solo DX/.04); bande da braccio legno 20054-20083 | **CERT** (DX) + **AN** (SX `A51922` per simmetria col legno `A51912`; gruppi 01-03 assunti) |
| supporto-forbice | `A50712.00.00` (fisso) | — | cert 625 (Scherenlager) | **CERT** |
| squadra-angolare | `A50922.07.00` (fisso) | — | cert 625 (Eckband) | **CERT** + **AN handedness**: cert dà un solo `.00`; il legno `A50904.36.01/.02` è mano-dipendente → **serve conferma se PVC ha DX/SX** |
| supporto-cerniera | `A50812.07.00` (fisso) | — | cert 625 (Ecklager) | **CERT** + **AN handedness** (come sopra; legno `A50801.01.01/.02`) |
| movimento-angolare | `A50302.01.02` ×2 | 362-1204/440-2510 | 19908 | COND |
| perno-supporto-forbice | `A50790.00.00` | — | 20462 | COND (**AN**: il perno potrebbe dipendere dal supporto forbice PVC `A50712`) |
| coperture-kit | `A51301.{01=DX,02=SX}.21` (Argento) per mano+finitura | — | 22107-22108 | COND (**AN**: il kit copertura copre supporto forbice+cerniera, che in PVC differiscono) |
| incontro-dss | `A51400.05.03` | — | 21476 ("ambidestro") | COND (**AN forte**: "DSS per PVC" è su listino separato, riga 36608) |
| incontro-ribalta | `A51400.05.70` | — | 36561 | COND (**AN forte**: "ribalta PVC" verosimilmente su listino separato) |
| incontri-nottolino | `A51400.05.02`, qty = 2 + ⌊H/600⌋ + ⌊L/600⌋ | passo 600 | 21291; formula da pilota legno | COND (**AN forte**: "Nottolino per PVC" su listino separato, riga 36583; formula ereditata dal legno) |
| chiusure suppl. (gated OFF) | `A50330.00.00`, `A51801.00.01`, `A51803.00.03`, `A50401.00.03` | H 1520÷2120 | come modulo legno | COND (**AN**: banda obbligatoria a listino è "LBB 861÷2510 per HBB>500", righe 19111/23746 — diversa dalla banda-altezza del pilota) |

## Alternative PVC nella cert (per contesto — NON usate)
La cert ha più schemi PVC (2,3,4,8,9) che variano supporto forbice / supporto
cerniera / (schema 4) squadra, per classi di peso/profilo diverse:

| Schema | riga | Scherenlager | Ecklager | Eckband |
|---|---|---|---|---|
| 2 | 608 | A50711.00.00 | A50811.07.00 | A50922.07.00 |
| 3 | 611 | A50720.07.00 | A50820.07.01 | A50922.07.00 |
| 4 | 614 | A50713.00.00 | A50815.07.00 | **A50911.36.01** |
| **8/9** (usato) | 625/627 | **A50712.00.00** | **A50812.07.00** | **A50922.07.00** |

Ho scelto **8/9** perché sono le uniche righe con etichetta esplicita
"**ARTech PVC**" (le 2/3/4 hanno "PVC" solo nella colonna Bandseite). Se il
profilo/peso target è diverso, l'esperto può indicare lo schema corretto.

## Domande aperte per l'esperto (priorità)
1. **Handedness** squadra angolare (`A50922.07.00`) e supporto cerniera
   (`A50812.07.00`): esistono varianti DX/SX (es. `.01/.02`) o sono ambidestri?
2. **Incontri PVC** (nottolino/DSS/ribalta): codici corretti dal "listino PVC e
   ALLUMINIO"? Ora riuso i codici legno.
3. **Braccio SX** `A51922.36.0N`: confermare l'esistenza a catalogo (cert mostra
   solo `A51921` DX / gruppo .04).
4. **Coperture** e **perno**: dedicati PVC o condivisi col legno?
5. **Schema di composizione** corretto (8/9 vs 2/3/4) per il profilo target?
6. **Chiusure supplementari**: regola di banda corretta (LBB 861÷2510)?
