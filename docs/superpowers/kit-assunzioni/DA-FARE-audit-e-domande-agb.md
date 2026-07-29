> ⚠️ **Le domande sono state unificate in [`DOMANDE-APERTE.md`](./DOMANDE-APERTE.md)**, che le
> raccoglie tutte — AGB e agente — con le bloccanti in cima. Qui restano il **testo della mail
> per AGB** (sotto, §2) e l'**audit di `kit_requests`** (§1), che non è una domanda.

# Due cose da fare fuori dall'app

> Preparate il 2026-07-26 perché nessuna delle due era ancora stata fatta.
> Non richiedono sviluppo: la prima è una query, la seconda una mail.

---

## 1. Audit delle distinte già emesse

**Perché.** La bonifica del 2026-07-25 ha spento **PVC** e **battente** perché producevano
distinte che il cliente non può ordinare (il PVC usciva con 4 righe su 12 senza prezzo; il
battente senza il gruppo di sospensione superiore, cioè con l'anta non appesa). Il codice è
corretto e i template sono disattivati su Neon, ma **le distinte già uscite verso i clienti
restano sbagliate**. Se ce ne sono, la priorità è avvisare gli agenti, non scrivere codice.

**Query da incollare** (Neon → SQL Editor, oppure `psql "$DATABASE_URL"`):

```sql
-- Quante richieste per tipologia e materiale, e in che periodo.
SELECT window_type, material, series, COUNT(*) AS n,
       MIN(created_at)::date AS dal, MAX(created_at)::date AS al
FROM kit_requests
GROUP BY 1, 2, 3
ORDER BY n DESC;
```

**Come leggere il risultato.**

| Cosa vedi | Cosa significa | Cosa fare |
|---|---|---|
| Solo righe `ANTA_RIBALTA`/`VASISTAS` + `LEGNO` | nessuna distinta rotta è uscita | niente, chiuso |
| Righe con `material = 'PVC'` | sono uscite distinte con 4 voci senza prezzo e totale sottostimato | recuperare i numeri richiesta (query sotto) e avvisare gli agenti |
| Righe con `window_type = 'ANTA_BATTENTE'` | sono uscite distinte a cui manca la sospensione superiore | **priorità alta**: è un problema di sicurezza del serramento, non di prezzo |

Se compaiono PVC o battente, questa dà i numeri richiesta e a chi sono intestate:

```sql
SELECT r.request_number, r.window_type, r.material, r.status,
       r.total_components, r.total_price, r.created_at::date,
       u.email AS agente, c.name AS cliente
FROM kit_requests r
JOIN users u ON u.id = r.agent_id
LEFT JOIN customers c ON c.id = r.customer_id
WHERE r.material = 'PVC' OR r.window_type = 'ANTA_BATTENTE'
ORDER BY r.created_at DESC;
```

**Nota sul contesto**: l'app è in staging da poco e le richieste create finora sono
plausibilmente solo di prova (il golden `KIT-2026-0001` è una di queste). L'audit serve a
confermarlo, non perché ci sia un sospetto.

---

## 2. Le domande per AGB

**Perché.** Sono 16 punti in cui il listino 2026 non decide da solo. Ogni assunzione è già
dichiarata nel codice e nelle schede, e il generatore **rifiuta** invece di indovinare dove
può; ma due domande sbloccano tipologie intere e le altre spostano prezzi reali.

Le schede complete sono in `docs/superpowers/kit-assunzioni/` (`legno.md` per le 1-10,
`tour.md` per le 11-16). Sotto, il testo pronto da inoltrare.

### Le due bloccanti

- **Domanda 1 — anta a battente, schema p0416 (414).** Lo schema elenca 21 voci e mostra
  **tre alternative di cerniera** senza dire quale valga per l'anta singola. Serve la terna
  corretta. *Con la risposta il battente si riattiva cambiando una riga.*
- **Domanda 6 — il «listino PVC e ALLUMINIO».** È citato più volte nel volume 2026
  (p0849 (847): «vedi sezione FERRAMENTA PER FINESTRE ARTECH del listino PVC e ALLUMINIO»),
  ma non lo abbiamo. *Con quel volume si riaprono PVC **e** alluminio insieme.*

### Testo pronto per la mail

> Buongiorno,
>
> stiamo sviluppando un generatore automatico di distinte ferramenta a partire dal listino
> 2026, per i nostri agenti. Il lavoro procede leggendo gli schemi di montaggio riga per riga,
> e siamo arrivati a 16 punti su cui il listino da solo non ci fa decidere. Dove non siamo
> certi il programma **si rifiuta di produrre la distinta** anziché tirare a indovinare, così
> non rischiamo di far montare la ferramenta sbagliata: per questo ogni risposta ci sblocca
> qualcosa di concreto.
>
> **Le due più importanti**
>
> 1. **Anta a battente, schema di montaggio a pag. 414.** Lo schema riporta 21 voci e mostra
>    tre alternative di cerniera. Per un'anta **singola** a battente in legno, quale terna di
>    cerniere va montata? Al momento la tipologia è disattivata perché senza questo dato la
>    distinta esce priva dell'appoggio superiore.
> 2. **Il «listino PVC e ALLUMINIO».** A pag. 847 (e in altri punti) il volume 2026 rimanda a
>    questo listino separato per nottolini, antieffrazione e DSS per PVC. Possiamo riceverlo?
>    Ci servirebbe per coprire PVC e alluminio, che oggi non possiamo trattare.
>
> **Anta-ribalta legno** (aria 12 · interasse 13 · battuta 20)
>
> 3. **Squadra angolare:** per una finestra tutto-legno il listino offre quattro varianti con
>    la stessa coppia di mano — `A50902.36` (base, 5,77 €), `A50903.36` (per traverso in
>    alluminio, 7,54 €), `A50901.36` (con compensatore, 8,05 €) e `A50904.36` (per traverso in
>    alluminio con compensatore, 9,83 €). Le legende degli schemi chiedono genericamente «con
>    compensatore»; il certificato ift «ARTech Legno» prescrive la `A50904.36`. Quale va usata?
> 4. **Incontri nottolino — c'è una contraddizione che non riusciamo a sciogliere.** Nelle
>    tabelle degli incontri il formato è scritto come token unico nella colonna ASSE (`9x18`,
>    `13x24`, `13x30`), dove il secondo numero è la sede telaio. Abbiamo estratto tutti i
>    formati dalle 959 pagine: esistono **solo** `9x18`, `9x20`, `13x24` e `13x30` — **`13x18`
>    non compare mai**. La distinta che usiamo come riferimento (vostra, del 16/11/2021)
>    dichiara però **interasse 13** e monta incontri **`9x18`** (`A51400.05.70`,
>    `A51400.05.02`). Quale delle due indicazioni è corretta: l'interasse è in realtà 9, oppure
>    gli incontri avrebbero dovuto essere `13x24`/`13x30`?
>    E, collegata: come si determina il **numero** di incontri perimetrali?
>
>    *(Nota di terminologia, che ci ha fatto perdere tempo e che forse vale anche per i vostri
>    clienti: la stessa quota è chiamata «sede telaio» nei titoli degli schemi, nella tabella
>    microventilazione e nel Galileo Pro alluminio, ma nelle tabelle degli incontri compare solo
>    come secondo numero di `asse × sede`. Un nostro agente esperto non ha riconosciuto la parola
>    «sede» proprio per questo.)*
> 5. **Sede 18 o sede 30?** Tutti gli schemi base ARTECH del 2026 sono intitolati «sede 30 mm»,
>    e la NB «per tipologia di serramento con sede incontri da 30 mm riferirsi agli schemi
>    "sede 30 mm"» compare su 22 pagine: la sede sembra distinguere due famiglie di schemi. Per
>    la **sede 18** però nel volume 2026 non troviamo alcuna pagina-schema, mentre la distinta
>    reale che usiamo come riferimento (del 16/11/2021) è proprio a sede 18. La sede 18 è ancora
>    ordinabile, o il 2026 l'ha sostituita con la 30? È la domanda che decide se il nostro
>    generatore sta lavorando sulla configurazione giusta.
> 6. **Finestre basse:** la tabella cremonesi che usiamo copre HBB da 610 a 2510. Per HBB fra
>    357 e 609 si usa la famiglia `A50122.15.31`/`.41`? Con quale regola, dato che si
>    selezionano per altezza **e** larghezza? E la `A50122.15.17` quando si usa?
> 7. **Altezza maniglia:** il cremonese si scelgono sull'HBB, che noi ricaviamo dall'altezza
>    dell'anta. Qual è la relazione corretta fra la quota misurata e l'HBB delle tabelle? Vale
>    la stessa per tutte le tipologie?
>
> **Vasistas legno** (schema pag. 416)
>
> 8. Per le tre cerniere si usa la variante base o l'alternativa? Servono entrambi i terminali?
> 9. La voce 7 dello schema (terminali delle chiusure supplementari sui montanti) va sempre
>    inclusa?
> 10. Il gruppo GR00 (HBB 274-662) è ordinabile? Non ne abbiamo la banda né la colonna NOT.
>
> **Bilico rettangolare TOUR** (sezione BILICI, pagg. 530-551)
>
> 11. **Asta di collegamento verticale senza braccetto** (`T46000.01.01` / `.02.01`): a pag. 546
>     compare solo nel gruppo 1, con HBB 580-1000. Le legende degli schemi generici però ne
>     scrivono il codice per esteso con suffisso `.01`, mentre per l'asta *con* braccetto usano
>     `0X` variabile. Su un bilico alto 1600 mm l'asta senza braccetto è `T46000.02.01`?
> 12. **Superficie esattamente 2 m²:** gli schemi generici dicono «< 2 m²» (3 lati) e «> 2 m²»
>     (4 lati). Con una misura di 2000 × 1000, cioè 2,00 m² esatti, si monta sui 3 o sui 4 lati?
> 13. **Guarnizione:** non compare nella legenda «Componenti» degli schemi generici, ma è
>     indicata su ogni pagina-schema. Va inclusa nella distinta della ferramenta? E la
>     confezione dello schema 1, dichiarata «12+12 m», contiene 12 o 24 metri di profilo?
> 14. **Kit spessori `T16635.04.01`** (schema 3, battuta 15): un kit copre entrambe le cerniere
>     o ne serve uno per cerniera?
> 15. **Kit elementi orizzontali:** i gruppi 1 e 2 si sovrappongono (530-650 e 640-800). Per una
>     larghezza di 645 mm si ordina `T47501.00.01` o `T47501.00.02`?
>
> Grazie, e scusate la lunghezza: abbiamo preferito chiedere tutto insieme invece di procedere
> per assunzioni.
>
> Cordiali saluti

*(La domanda 16 non è per AGB: è un rilievo interno — `openingDir` è raccolto dal wizard e non
letto da nessun modulo. Vedi `tour.md`.)*
