# Prompt di apertura — prossima sessione

> Copia il blocco fra le righe e incollalo come primo messaggio.
> La prossima sessione è **di decisioni**, non di esecuzione: i dettagli li dai tu.

---

Ciao. Riprendiamo UFPtrade. Leggi prima `handoff.md` (§RIPRENDI DA QUI) e `CLAUDE.md`.

**Questa sessione è diversa dalle precedenti: voglio discutere e prendere decisioni
progettuali importanti, che porteranno grandi cambiamenti.** I dettagli te li do io
qui sotto. Non aprire codice per primo: prima ascolta, poi ragiona, e usa
`/brainstorming` e `/llm-council` **prima** di scrivere qualunque riga.

**Cosa voglio cambiare / discutere:**

> **[SCRIVI QUI]**

**Come voglio che tu lavori, in ordine:**

1. **Leggi `handoff.md` §RIPRENDI DA QUI**: c'è la tabella delle **decisioni
   strutturali già prese** con la ragione di ciascuna, e l'elenco dei **debiti
   strutturali**. Non ridiscutere una decisione senza sapere quale argomento la
   sosteneva: quasi tutte sono state prese *contro* un'alternativa che sembrava
   migliore.
2. **Fammi le domande che servono.** Se una scelta cambia materialmente il lavoro,
   chiedimela invece di assumere. Se per rispondere ti serve misurare qualcosa sul
   catalogo vero, misura: l'ambiente si monta con `bash scripts/dev-bootstrap.sh`
   e `pnpm import:listino COLOMBO <listino.xlsx>` (i file stanno nella cartella
   Drive registrata in `CLAUDE.md`, il cui riuso è già autorizzato).
3. **`/llm-council`** su ogni dubbio architetturale vero — e **verifica nel repo le
   affermazioni degli advisor prima di sintetizzare**: nelle sessioni scorse più di
   un argomento del council è caduto su un fatto controllato in dieci minuti.
4. **Spec, poi piano, poi TDD.** Niente codice prima della spec.
5. **Dimmi il costo prima di pagarlo**: se una decisione implica una migrazione,
   una finestra di disservizio o un run ops, voglio saperlo *quando decidiamo*, non
   quando è fatta.

**Vincoli permanenti che restano validi**: TypeScript strict · tutto via tRPC ·
regole di dominio in TypeScript e mai nel raw SQL · UI in italiano, codici in
monospace · **mobile-first verificato a 375px in browser vero** · admin crea tutti
gli account · il repo è **pubblico**, quindi listino, giacenze e foto del fornitore
non si committano mai · un run ops con migrazione va lanciato **sul ref del branch,
prima del merge**.

**Dove siamo, in tre righe.** Reparto SERRAMENTI (AGB): catalogo 7.488 prodotti,
chat, e generatore di distinte con tre tipologie attive. Reparto MANIGLIE (COLOMBO):
3.456 articoli, sfoglio a tre livelli, pronta consegna, filtro colori, e **2.118
articoli con foto (61,3%)** in produzione. Tutto su un solo repo, un solo database,
un solo Better Auth.

**Cose aperte che potrebbero intrecciarsi con quello che decideremo:**

- 🔴 **Vercel Pro** (Hobby vieta l'uso commerciale): era deciso per il 08/08 — fatto?
- 🔴 **Le tre distinte reali di MC, Peruzzi e Fosca**: pendono da cinque sessioni, e
  sono la cosa aperta che vale di più.
- La **migrazione multi-marca**, rimandata alla marca #3: 128 occorrenze in 22 file.
- Le **7.082 foto AGB dentro Postgres**, causa unica dei tre limiti di piattaforma.
- Due domande in attesa: una per **COLOMBO** (quale archivio è MR11 e quale MR15,
  idem LC31/LC41 e LC71/LC81: 66 codici senza foto) e una per **Andrea** (le
  fusioni di etichette che non ha citato).

---

## Se invece la sessione fosse solo di esecuzione

Lavoro pronto da prendere, senza decisioni da prendere prima:

- **`updateMany` al posto di 1.995 `update` singoli** in `scripts/foto-colombo.ts`:
  sono i 4 minuti più lenti di ogni run ops.
- **Le preview Vercel sono rosse su ogni PR** da mesi, anche su PR di soli
  documenti (verificato sulla #53): nessuno l'ha mai diagnosticato.
- **Le tre distinte reali**, se nel frattempo sono arrivate.
- I **pomoli dei modelli** (`bold_45`, `daytona_45`, `drop_45`, `mapo_45`,
  `Moon_45`, `spider_45`): oggi fuori perché quale serie sia il pomolo non è
  scritto. Se COLOMBO risponde, sono altre decine di codici con foto.

## File del fornitore (dove si prendono)

| File | A cosa serve | Dove |
|---|---|---|
| `LISTINO 02 2026 …xlsx` (foglio `LP 02-26`, 3.456 codici) | è quello in produzione | cartella Drive in `CLAUDE.md` |
| `pronta consegna colombo.xls` | aggancio e orfani | idem |
| `ER MAN 2026_100726.pdf` | le 31 finiture (p13) | idem |
| Archivio fotografico (79 zip, 707 foto) | le foto | area download COLOMBO, password dall'utente |
