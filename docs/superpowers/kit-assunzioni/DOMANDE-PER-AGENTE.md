# Domande per un agente esperto — anta-ribalta

> Da girare a un collega che vende e configura serramenti. **Niente codici, niente gergo del
> programma**: si risponde in dieci minuti.
>
> Servono per **allargare la copertura del generatore oltre l'unica configurazione che tratta
> oggi** (aria 12 · interasse 13 · battuta 20 · sede 18). Sono diverse dalle domande per AGB
> (`DA-FARE-audit-e-domande-agb.md`): lì si chiede al produttore cosa prescrive il listino, qui
> si chiede a chi vende **cosa succede davvero nella pratica**.

---

## Come si legge un serramento

1. Quando un cliente vi chiede un kit, dove leggete **aria, asse, battuta, sede ed entrata**?
   Sul disegno del serramentista, su una scheda tecnica, o ve li dice a voce?
2. Ce n'è qualcuno che nella pratica **non chiedete mai** perché è sempre lo stesso?
3. Se un cliente non ve li sa dire, come fate?

## Quali combinazioni capitano davvero

4. Quali sono le **tre o quattro combinazioni che ordinate più spesso**? Mettetele in ordine
   di frequenza.
5. Ci sono combinazioni che il listino prevede ma che **non vi capitano mai**?
6. La **sede 30** è ormai lo standard, o si ordina ancora la **18**? Vi capita di ordinarle
   entrambe?
7. L'**entrata**: usate sempre la stessa? Quale? E da cosa dipende quando cambia?

## Cosa entra sempre nella distinta e cosa no

8. La **microventilazione** la mettete sempre o solo se il cliente la chiede?
9. Il **doppio nottolino a fungo** (antieffrazione) è di serie o è un'opzione a parte?
10. Gli **spessori di sollevamento** quando servono? Sempre, o solo su ante di un certo peso o
    misura?
11. Il **DSS** lo mettete sempre?
12. Le **coperture degli incontri** le ordinate insieme al kit o separatamente?
13. Le **chiusure supplementari**: da quale altezza in su le mettete?

## Quantità

14. Il **numero di incontri lungo il perimetro** come lo decidete? C'è una regola pratica, tipo
    uno ogni tot centimetri, o si legge da una tabella?

## Finiture

15. Quali **finiture** vendete davvero? Oggi il programma conosce solo l'argento.

## Il caso concreto

16. La finestra **700 × 1400, battuta 18, sede 30** che abbiamo provato: è una richiesta vera di
    un cliente? Se sì — **sapete quale distinta è stata poi effettivamente ordinata?** Anche una
    foto dell'ordine andrebbe benissimo.

> La **16** è la più preziosa di tutte. Se esiste una distinta reale per quella configurazione
> diventa il **secondo golden**, e possiamo *verificare* la copertura invece di fidarci della
> nostra trascrizione. È esattamente così che è nato il pilota: da una distinta reale del
> 16/11/2021.

---

## Perché servono proprio queste — nota tecnica per chi sviluppa

Ricostruendo il listino, ogni voce della distinta dipende da un parametro preciso:

| Pezzo | Codice oggi | Dipende da |
|---|---|---|
| Cremonese | `A50122.`**`15`**`.NN` | **entrata** (0 / 8 / 15) × HBB |
| Braccio forbice | `A51911.`**`36`**`.0N` | **battuta × interasse** × LBB × mano |
| Squadra angolare | `A50904.`**`36`**`.0N` | **aria × battuta** × interasse × mano |
| Supporto cerniera | `A50805.`**`05`**`.DX` | **aria × interasse × battuta** × mano |
| Incontri (nottolino, ribalta, DSS) | `A51400.`**`05`**`.xx` | **aria × (asse × sede)** |
| Fusto forbice | `A50510.00.0N` | LBB |
| Movimento angolare · supporti forbice · perno | fissi | niente |
| Coperture | `A51301.0N.21` | finitura × mano |
| Chiusure supplementari | `A50330` · `A50401` · `A51801` · `A51803` | lunghezza |

Le domande **1-7** servono a sapere quali combinazioni vale la pena coprire per prime; le
**8-13** a decidere quali voci dello schema `p0406 (404)` sono obbligatorie e quali opzionali
(sei voci su 22 non trovano oggi corrispondenza nel modulo); la **14** è la formula degli
incontri, oggi un'assunzione tarata sul solo golden; la **15** perché `COPERTURE_KIT` ha una
sola finitura trascritta.

⚠️ **L'entrata è un parametro che il wizard non chiede affatto**: il cremonese esiste in entrata
0, 8 e 15, e il motore usa sempre la 15 cablata, senza guardia. Un serramento con entrata 8 oggi
riceve **in silenzio** il cremonese sbagliato. È la stessa classe di bug che la bonifica ha chiuso
per aria/asse/battuta/sede, sopravvissuta su un parametro che non era mai stato notato.
