# CronoStrada

Programma per cronometrare e classificare le gare podistiche su strada.
Sostituisce il foglio Excel: prende gli iscritti esportati da WISE, cronometra gli
arrivi, calcola categorie e classifiche, stampa le premiazioni e riesporta il CSV
da ricaricare su WISE.

**Indirizzo del sito:** https://atleticaovadese.github.io/cronostrada/

---

## Indice

- [In due parole](#in-due-parole)
- [Installala sul telefono](#installala-sul-telefono)
- [La cosa più importante da sapere: dove finiscono i dati](#la-cosa-più-importante-da-sapere-dove-finiscono-i-dati)
- [Le tre caselle del menu](#le-tre-caselle-del-menu)
- [Le otto schede](#le-otto-schede)
- [Il giorno della gara, passo per passo](#il-giorno-della-gara-passo-per-passo)
- [Quando qualcosa va storto](#quando-qualcosa-va-storto)
- [La copia di emergenza su chiavetta USB](#la-copia-di-emergenza-su-chiavetta-usb)
- [Come si aggiorna il sito](#come-si-aggiorna-il-sito)
- [La rete di sicurezza: i test automatici](#la-rete-di-sicurezza-i-test-automatici)
- [Com'è fatto il progetto](#comè-fatto-il-progetto)

---

## In due parole

CronoStrada è **una pagina web sola**. Non è un programma da installare, non ha
bisogno di internet per funzionare, non manda i dati a nessuno.

Tre conseguenze pratiche, tutte a tuo favore:

- **Al traguardo puoi stare senza rete.** Una volta che la pagina è aperta,
  internet non serve più. Puoi metterti in modalità aereo: il cronometro va
  avanti come niente fosse.
- **I dati degli atleti restano sul tuo dispositivo.** Non passano da nessun
  server, né mio né di GitHub. Nessuno li vede oltre te.
- **Non si rompe con un aggiornamento.** Quello che ti funziona oggi è un file
  solo, e ne hai una copia sulla chiavetta.

---

## Installala sul telefono

Vale la pena farlo: installata, CronoStrada parte come una app qualsiasi, a
schermo intero, **e funziona anche in modalità aereo**. Misurato: riparte in
meno di un decimo di secondo senza rete.

**Su Android:** apri il sito, vai sulla scheda **Gara** e premi **Installa sul
telefono**. Il pulsante compare da solo quando il browser lo permette.

**Su iPhone** va fatto a mano, perché Safari non offre il pulsante:

1. apri https://atleticaovadese.github.io/cronostrada/ in Safari
2. tocca **Condividi** in fondo allo schermo — il quadrato con la freccia in su
3. scorri l'elenco e scegli **Aggiungi a Home**

Poi apri la app dall'icona, non più da Safari.

> **Prima di installarla, leggi la Regola 2 qui sotto.** La app installata ha
> una memoria sua, separata da quella del browser: se hai già preparato la gara
> in Safari, devi portarla di là con un backup.

**Quando esce una versione nuova** compare in basso un avviso discreto — *È
disponibile una versione aggiornata* — con un pulsante **Ricarica**. Decidi tu
quando. E se il cronometro è in funzione, l'avviso **non compare nemmeno**:
aspetta in silenzio la fine della gara. La app non si aggiorna mai da sola.

---

## La cosa più importante da sapere: dove finiscono i dati

CronoStrada salva **nella memoria del browser** del dispositivo che stai usando.
Non su un server. Da qui derivano tre regole che vale la pena leggere una volta
con calma, adesso, e non il giorno della gara.

### Regola 1 — Un dispositivo, una gara

I dati stanno nel browser di **quel** dispositivo. Se registri gli arrivi dal
telefono, sul computer non li vedi comparire da soli.

Con l'accesso fatto (menu → **Organizzatore**) c'è anche una copia sul server, e
lì l'elenco delle gare ti dice a colpo d'occhio dove sta ognuna:

| Etichetta | Vuol dire |
|---|---|
| **solo qui** | Sta soltanto su questo dispositivo. Se si rompe, non esiste più da nessuna parte. |
| **solo sul server** | L'hai preparata altrove. Aprendola, la scarichi qui. |
| **qui e sul server** | Sta in tutti e due i posti. |

**Aprire una gara che è solo sul server la scarica per intero** — nome, fasce,
iscritti, arrivi, correzioni, ritiri — e da quel momento è questo dispositivo a
mandarla su. O arriva tutta o non arriva niente: non esistono gare scaricate a
metà. È il modo giusto di preparare la gara sul computer e cronometrarla dal
telefono.

Tre cose che la app non fa, e non per dimenticanza:

- **non fonde due dispositivi che scrivono insieme.** Uno solo sta al traguardo.
  Se anche l'altro registrasse arrivi, sul server ci finirebbero tutti, ma
  ognuno dei due continuerebbe a vedere solo i propri finché non riscarica.
- **non sovrascrive mai quello che qui non è ancora partito.** Se la copia
  locale ha operazioni in coda, si ferma e ti chiede cosa fare, dicendoti quante
  e di che tipo. Nel dubbio vince quello che hai in mano.
- **non tocca una gara in corso.** Col cronometro che cammina non si scarica
  niente, per nessun motivo.

**Per eliminarne una** premi la × nell'elenco. Se la gara sta in due posti ti
chiede cosa vuoi fare, e sono due cose diverse:

| Scelta | Cosa succede |
|---|---|
| **Solo da questo dispositivo** | Sparisce di qui e resta sul server. La rivedi subito nell'elenco come «solo sul server». |
| **Anche dal server, per sempre** | Se ne va da tutte e due, con iscritti, arrivi, correzioni, ritiri e classifica pubblicata. Non si recupera. |

In tutti e due i casi va scritta la parola `ELIMINA`. Le gare nate su un altro
dispositivo, quelle che risultano «solo sul server», si eliminano da qui allo
stesso modo.

**Quindi:** decidi in anticipo quale dispositivo sta al traguardo, e usa solo
quello per tutta la gara.

### Regola 2 — Ogni "posto" da cui apri la app ha la sua memoria

Questa sorprende tutti, quindi te la dico chiara.

Il browser tiene le memorie separate. Questi tre sono, per lui, **tre posti
diversi**, ognuno con i suoi dati e cieco a quelli degli altri:

1. il sito aperto nel browser, `atleticaovadese.github.io/cronostrada`
2. la app **installata** sulla schermata Home
3. il file `CronoStrada.html` aperto dalla chiavetta USB

Il punto 2 sorprende quasi tutti, e su iPhone è particolarmente insidioso:
**la app installata non vede i dati di Safari**, nemmeno se è lo stesso
indirizzo e lo stesso telefono.

**Quindi:** se prepari la gara nel browser e poi installi la app, gli iscritti
importati **non compaiono da soli**. Per spostarli devi passare da un backup:
`Scarica backup .json` da una parte, `Carica backup .json` dall'altra. Vedi
[Quando qualcosa va storto](#quando-qualcosa-va-storto).

**La regola pratica:** decidi *prima* da dove userai la app il giorno della
gara — installata, oppure dal browser — e prepara tutto lì. Non cambiare posto
a metà.

### Regola 3 — Il backup non è facoltativo

Svuotare la cronologia del browser, la navigazione in incognito, o un "pulisci i
dati dei siti" fatto per abitudine: ognuna di queste cose cancella la gara.

**Gli arrivi si salvano nell'istante stesso in cui li registri**, non un
momento dopo: se il telefono si riavvia, arriva una telefonata o il sistema
chiude il browser per fare memoria, quello che hai premuto è già al sicuro.
Restano le tre cose qui sotto da sapere.

**Quindi**, due difese, e mettile in campo entrambe:

1. **Su Chrome o Edge da computer** — scheda **Gara** → **Collega file di
   salvataggio**. Scegli un file `.json`, e da quel momento ogni singola modifica
   viene scritta anche su disco, da sola, senza che tu faccia niente. È la
   difesa migliore. Attivala prima della partenza.
2. **Sempre e comunque** — il pulsante **Backup file** in alto a destra scarica
   un `.json` con tutta la gara dentro. Premilo dopo l'importazione degli
   iscritti, una o due volte durante gli arrivi, e a gara finita.

In alto a destra c'è sempre scritto lo stato del salvataggio, con l'ora
dell'ultimo. Se quel pallino diventa rosso, leggi il messaggio: te lo sta
dicendo che qualcosa non sta salvando.

---

## Le tre caselle del menu

Aprendo la app si sceglie da dove entrare. Nient'altro: niente elenchi, niente
da leggere prima di decidere.

| Casella | Cosa c'è dentro | Serve l'accesso? |
|---|---|---|
| **Organizzatore** | Le tue gare: cronometro, iscritti, classifiche, stampe | No per lavorare, sì per la copia sul server |
| **Live** | Le classifiche pubbliche, che si aggiornano da sole | No, mai |
| **Prossimi appuntamenti** | Le locandine e i volantini delle gare in arrivo | Solo per appenderli |

Sotto le caselle c'è un **codice QR**: inquadrandolo si apre la app. È lì per
chi ti sta davanti al banchetto e vuole vedere le classifiche sul suo telefono
— non deve installare niente.

> **Se una gara è in corso il menu non compare.** La app si apre dritta sugli
> arrivi, col cronometro che cammina. Allo sparo non si tocca niente.

### Prossimi appuntamenti

Le locandine le vede **chiunque**, anche senza accesso, e si aprono toccandole:
sono un normale collegamento, che si può mandare anche su WhatsApp.

Le appende **chi organizza gare**, cioè chi ha almeno una gara sua su
CronoStrada. Non serve nessun elenco di permessi da tenere aggiornato: se
organizzi, puoi appendere. Foto (jpg, png, webp) e PDF, **fino a 5 MB l'uno**;
il limite e i tipi li fa rispettare il server, non solo la app.

Togliere una locandina la fa sparire per tutti, subito, e non si torna
indietro: chi ne aveva il collegamento non la apre più.

---

## Le otto schede

| Scheda | A cosa serve |
|---|---|
| **Gara** | Nome, data, località, distanza. Quanti atleti premi. Quali categorie FIDAL accorpare in ogni fascia di premiazione. Backup. |
| **Iscritti** | L'elenco degli atleti. Si importa da WISE o si scrive a mano. Ogni riga è modificabile direttamente. |
| **Arrivi** | Il cronometro e la registrazione degli arrivi. È la schermata della gara. |
| **Classifiche** | Generale, per categoria, per società. Si stampa. |
| **Premiazioni** | Chi va premiato, fascia per fascia. Compaiono solo le fasce con almeno un premiato. Si stampa. |
| **Società** | Classifica a squadre, per iscritti confermati o per arrivati. |
| **DNS / DNF** | Chi non è partito e chi si è ritirato. |
| **Export** | Il CSV da ricaricare su WISE, più le classifiche in CSV. |

### Come si calcolano le categorie

**Anno di riferimento − anno di nascita.** Identico al foglio Excel. L'anno di
riferimento si allinea da solo alla data della gara; se per qualche motivo i due
non coincidono la app te lo segnala con un avviso, e ti offre il pulsante per
allinearli.

I premiati **assoluti** vengono esclusi dalla classifica della loro categoria,
come nel file originale: il primo assoluto maschile non compare anche primo della
sua fascia.

### I tempi si troncano

Un atleta che arriva a 33 minuti 59 secondi e 8 decimi risulta **33:59**, non
34:00. È il regolamento, e la app lo rispetta in ogni schermata e in ogni export.
Se in un CSV vedi comparire un secondo arrotondato per eccesso, c'è un problema:
segnalalo.

---

## Il giorno della gara, passo per passo

### La sera prima (dieci minuti, con calma)

1. Apri https://atleticaovadese.github.io/cronostrada/
2. Scheda **Gara**: nome, data, località, chilometri. Controlla i numeri delle
   premiazioni e le fasce di categoria.
3. Scheda **Iscritti** → **Importa da WISE**. Scegli il file `.xlsx` o `.csv`
   esportato da WISE. La app riconosce le colonne da sé; nella finestra che si
   apre controlla che l'anteprima abbia senso e conferma.
4. Guarda le segnalazioni in arancione: pettorali doppi, omonimi, atleti senza
   data di nascita, categorie senza fascia di premiazione. **Sistemale ora.**
   Trovarsele a premiazione già annunciata è un'altra cosa.
5. **Backup file.** Metti il `.json` in un posto che ritrovi.
6. Se hai un computer con Chrome o Edge, attiva anche **Collega file di
   salvataggio**.

### Al campo, prima della partenza

7. Apri la app **quando hai ancora rete**, e da quel momento non chiudere la
   scheda del browser. Se prevedi di non avere campo, aprila da casa e porta il
   dispositivo con la scheda già aperta.
8. Vai sulla scheda **Arrivi** e lasciala lì.
9. Se il dispositivo è un telefono, mettilo in carica o parti con la batteria
   piena, e disattiva lo spegnimento automatico dello schermo.

### Lo sparo

10. Premi **START**. Il cronometro parte e compare l'orario della partenza.

Se te ne dimentichi non è un dramma: **Modifica orario** ti fa impostare
l'orario dello sparo anche dopo, e tutti i tempi si spostano di conseguenza
senza che nessun arrivo vada perso e senza che l'ordine cambi.

### Gli arrivi — dal telefono

Sul telefono la app ha **un suo tastierino**, disegnato dentro la pagina. Non
usa più la tastiera di sistema: quella di iPhone non ha il tasto invio e non
permetteva di confermare il pettorale.

- **Se leggi il pettorale:** lo digiti sul tastierino. Il pulsante verde cambia
  scritta e diventa **ARRIVO 126**, così vedi a colpo d'occhio cosa stai per
  registrare, e sotto compare il nome dell'atleta.
- **Se non fai in tempo:** premi il pulsante verde con il campo vuoto, dove c'è
  scritto solo **ARRIVO**. Registra il tempo e basta.
- **Se sbagli una cifra:** `⌫` cancella l'ultima, `C` svuota tutto.
- **Per completare dopo un pettorale mancante:** tocca la casella arancione di
  quella riga nell'elenco. Il tastierino passa in modalità assegnazione, ti
  ricorda l'ora di quell'arrivo, e il pulsante diventa **ASSEGNA 126**. Anche
  qui la tastiera del telefono non si apre mai.

A ogni arrivo il telefono **vibra** e lo schermo dà un **lampo verde**: al
traguardo non c'è tempo di leggere un messaggio.

I tasti non si spostano mai, nemmeno quando compaiono avvisi: al traguardo si
preme senza guardare. Cronometro e tastierino restano sempre in alto, l'elenco
arrivi scorre sotto.

**Per vedere meglio l'elenco:** il pulsante in alto a destra del pannello nero
riduce il cronometro a una barra sottile — restano il tempo e il pulsante
ARRIVO — e l'elenco arrivi passa da 2 righe a 7. Serve quando completi i
pettorali mancanti e devi vedere quali righe sono ancora in arancione. La app
si ricorda come l'hai lasciato.

**Lo schermo non si spegne** da solo mentre il cronometro va, e torna normale
quando premi STOP.

**In volata puoi premere a raffica.** Non c'è nessun ritardo e nessun blocco fra
due pressioni ravvicinate: ogni pressione registra un arrivo. Nella gara di
riferimento 26 atleti su 265 sono arrivati entro un secondo dal precedente, con
un minimo di 0,22 secondi, e i test verificano proprio questo.

### Gli arrivi — dal computer

Dal computer non è cambiato nulla.

**Se fai in tempo a leggere il pettorale:** scrivi il numero nel campo grande e
premi **Invio**. Mentre digiti, sotto compare il nome dell'atleta — così ti
accorgi subito se hai sbagliato numero, e la app ti avvisa in rosso se quel
pettorale è già arrivato.

**Se arrivano in gruppo e non fai in tempo:** premi **Spazio** (o il pulsante
grande **ARRIVO**). Registra il tempo e basta, senza pettorale. Il pettorale lo
scrivi dopo, con calma, nell'elenco arrivi sulla destra: il tempo è già salvo, è
quello che conta.

**Se sbagli:** **Ctrl+Z**, oppure **Annulla ultimo**. Toglie l'ultimo arrivo
registrato.

Tieni d'occhio l'avviso arancione in cima: ti dice quanti arrivi sono ancora
senza pettorale e quanti sono da verificare.

### Quando è passato l'ultimo

11. **STOP cronometro**. Non si registrano più arrivi. La app ti chiede se vuoi
    dichiarare ritirati (DNF) gli atleti confermati che non sono arrivati:
    puoi dire sì subito o farlo dopo dalla scheda **DNS / DNF**.
12. Se scopri che c'è ancora qualcuno in gara, **Riprendi cronometro**. Non
    perdi niente: il riferimento resta sempre lo sparo.

### Le classifiche

13. **Backup file.** Adesso, prima di toccare qualsiasi altra cosa.
14. Scheda **Iscritti**: controlla che non sia rimasto nessun arrivo senza
    pettorale.
15. Scheda **Classifiche** e **Premiazioni** → **Stampa**. Il pulsante apre la
    stampa del browser: da lì scegli la stampante oppure "Salva come PDF".
    Le schermate sono già impaginate per la stampa, i menu non compaiono.
16. Scheda **Export** → **Scarica CSV WISE**, e ricarichi quel file su WISE.

---

## Quando qualcosa va storto

**Il telefono si è spento / il browser è crashato.**
Riapri la app. I dati sono nella memoria del browser e sono ancora lì: la app
riparte da dove era, cronometro compreso, perché il riferimento è l'orario dello
sparo e non un conteggio che si azzera.

**Ho chiuso la scheda per sbaglio.**
Come sopra: riaprila e ritrovi tutto.

**Devo passare a un altro dispositivo a metà gara.**
Sul primo: **Scarica backup .json**. Porti il file sul secondo (cavo, email,
chiavetta, quello che hai). Sul secondo: **Carica backup .json**. Da quel momento
prosegui sul secondo e **non toccare più il primo**, altrimenti finisci con due
gare diverse e nessuna delle due completa.

**Non ho rete al traguardo.**
Non serve. Se la pagina è già aperta, va avanti da sola.

**Non ho rete e la pagina non è aperta.**
È il momento della chiavetta. Vedi il capitolo qui sotto.

**Ho perso tutto e ho solo il backup.**
Apri la app (dal sito o dalla chiavetta), scheda **Gara** → **Carica backup
.json**. Torni al momento del backup.

---

## La copia di emergenza su chiavetta USB

Nella cartella `dist/` c'è **`CronoStrada.html`**: la app identica a quella del
sito, in un file solo.

**Copiala su una chiavetta USB e tienila nella borsa del cronometraggio.**

Si apre con un doppio clic, da qualsiasi computer, senza internet e senza
installare niente. È la tua rete di sicurezza per il caso in cui il sito non
raggiungibile, il telefono morto, la rete assente — tutti insieme, che di solito
è come vanno queste cose.

Due avvertenze, entrambe importanti:

- **Ricordati la Regola 2**: la copia su chiavetta ha una memoria sua, separata
  da quella del sito. Se hai già iniziato la gara online, per continuare da qui
  devi passare da un backup `.json`.
- La copia su chiavetta **non si aggiorna da sola**. Ogni volta che aggiorni il
  sito, ricopiala. Il comando è nel capitolo seguente.

---

## Come si aggiorna il sito

Da fare **mai il giorno della gara**. Aggiorna dopo, con calma, e riprova.

Il file da modificare è **`index.html`** nella cartella principale: è la app che
il sito pubblica. Poi si allinea la copia di emergenza e si manda tutto su
GitHub, che ripubblica da solo.

### I comandi, nell'ordine

Apri PowerShell nella cartella del progetto e lancia questi tre gruppi.

**1. Allinea la copia di emergenza** (sempre, dopo ogni modifica a `index.html`):

```bash
Copy-Item -LiteralPath ".\index.html" -Destination ".\dist\CronoStrada.html" -Force
```

**2. Controlla che le due copie siano davvero identiche:**

```bash
if ((Get-FileHash .\index.html).Hash -eq (Get-FileHash .\dist\CronoStrada.html).Hash) { "IDENTICHE - ok" } else { "DIVERSE - rifai la copia" }
```

**3. Allinea la versione della app installata** (sempre, dopo ogni modifica a
`index.html`):

```bash
npm run versione
```

Senza questo, chi ha la app installata sul telefono continuerebbe a usare la
versione vecchia per sempre, senza che nessun avviso glielo dica. Se te ne
dimentichi `npm test` fallisce e ti ricorda questo comando.

**4. Manda su GitHub:**

```bash
git add -A; git commit -m "Descrivi qui cosa hai cambiato"; git push
```

Da qui GitHub fa il resto: prima fa girare i 17 test sui dati della gara reale,
e **solo se passano tutti** pubblica il sito. Entro due o tre minuti è online.

Puoi seguire tutto dalla scheda **Actions** del repository — pallino verde
significa fatto, pallino rosso significa che un test ha trovato un problema e il
sito è rimasto alla versione precedente, quella che funzionava. Cliccando sul
pallino rosso leggi quale atleta e quale valore non torna.

### Il browser mi mostra ancora la versione vecchia

Il browser tiene le pagine in cache. Forza il ricaricamento:

- **Computer:** `Ctrl+F5` (Windows) o `Cmd+Shift+R` (Mac)
- **Telefono:** chiudi e riapri la scheda, o svuota la cache del sito

Attenzione a non svuotare "tutti i dati del sito" se hai una gara in corso: quella
è l'operazione che cancella la gara. Il ricaricamento forzato invece è sicuro.

### Non sono mai tornato indietro, come faccio se un aggiornamento rompe qualcosa

Ogni modifica mandata su GitHub resta nella storia del repository, e si può
tornare a qualunque versione precedente. Se ti serve, chiedi — o più
semplicemente: apri la chiavetta USB, che ha la versione che funzionava.

---

## La rete di sicurezza: i test automatici

Ogni volta che si manda una modifica su GitHub, **140 test verificano da soli**
che la app dia ancora gli stessi risultati di una gara vera già disputata: la
7ª Stradolcetto, 280 iscritti e 265 arrivi, con categorie e posizioni prese dal
foglio Excel.

Se un solo valore non torna, **il sito non viene pubblicato** e resta alla
versione precedente — quella che funzionava. Non è possibile mettere online una
versione che sbaglia i conti.

Cosa controllano, in breve:

- le 280 categorie FIDAL e le 280 fasce di premiazione
- le 265 posizioni assolute e le 265 posizioni di categoria, compresa
  l'esclusione dei primi tre assoluti maschili e femminili dalla loro fascia
- i conteggi: 269 confermati, 11 DNS, 4 DNF, 51 società
- che i tempi si **troncino**: il primo arrivato deve risultare `33:59` e non `34:00`
- che l'omonimia presente nei dati venga segnalata (due atleti diversi con lo
  stesso cognome e nome, che devono restare entrambi in classifica)
- i gesti del traguardo: importazione da WISE, arrivo con e senza pettorale,
  STOP e ripresa, spostamento dell'orario di partenza, azzeramento, e i dati
  che sopravvivono a un ricaricamento della pagina
- che `dist/CronoStrada.html` sia ancora identica a `index.html`

### Il collaudo finale

Uno di questi test non prova un pezzo: prova la giornata. Rifà la gara vera
dall'inizio alla fine — i 280 iscritti importati dal file WISE, i 265 arrivi,
una parte con il pettorale dettato dopo, qualche tempo corretto a mano, un
ritiro, la partenza spostata — con **la rete che manca** per il grosso della
gara e che torna **mentre la gara è ancora in corso**. Alla fine nessuno tocca
più niente e la coda deve arrivare a zero da sola, con sul server i conteggi
esatti; poi due sincronizzazioni in più che non devono aggiungere una riga.

Esiste per un difetto vero: l'invio si fermava a 555 righe su 834 e non
ripartiva più. Nessun test se n'era accorto perché nessuno percorreva una gara
intera — con venti righe la coda si svuota al primo giro e il difetto non ha
modo di comparire. Serviva il volume vero per farlo uscire, e da allora quel
volume si percorre a ogni pubblicazione.

Quando un test fallisce dice **quale atleta** e **quale valore** non torna:

```
categoria FIDAL: 1 valori su 280 non corrispondono ai risultati della gara reale.

  pettorale 265 — GRECO FRANCESCO (M, 2003, RUNCARD)
      categoria FIDAL atteso dal foglio Excel: PM
      categoria FIDAL calcolato dalla app:     SM
```

### Farli girare sul tuo computer

Serve Node.js. La prima volta:

```bash
npm install; npm run browser
```

Poi, ogni volta che vuoi:

```bash
npm test
```

### Chi controlla i controllori

Una suite tutta verde non dimostra niente finché non si è visto che sa anche
diventare rossa. Questo comando rompe la app di proposito, una rottura per
volta, e verifica che i test se ne accorgano:

```bash
npm run mutazioni
npm run mutazioni -- troncamento    # solo quelle che contengono la parola
```

Le rotture sono quelle che farebbero il danno peggiore, perché sbagliano
**in silenzio**. Quattro sui calcoli — arrotondamento al posto del
troncamento, soglia di categoria spostata di un anno, premiati assoluti non
più esclusi dalla loro fascia, rilevamento degli omonimi che non scatta più —
e dieci sulla sincronizzazione: una gara che arriva a metà, l'invio che si
ferma, una riga rifiutata che non riparte più, i tempi che si spostano
scendendo dal server.

Serve anche a togliere: se una rottura non fa diventare rosso nessun test,
o si scopre un buco nei test, oppure quel pezzo di codice non stava
difendendo niente. È già successo.

Alla fine `index.html` torna identico al byte, sempre: anche se un test va
storto, anche se interrompi lo script a metà, anche se chiudi la finestra di
brutto (in quel caso se ne accorge al lancio successivo e ripara da solo).

Gira anche su GitHub Actions, ma **una volta a settimana** e non a ogni
modifica: è una verifica della qualità dei test, non della modifica in arrivo,
e richiede una esecuzione completa della suite per ogni rottura.

### I dati su cui girano

I test **non** usano i dati veri. Usano `reference_anon.json` e
`wise_iscritti_anon.xlsx`: nomi e giorno/mese di nascita sono di fantasia,
mentre pettorali, sesso, società, **anno** di nascita, tempi, categorie e
posizioni sono quelli autentici della gara.

Funziona perché la categoria dipende solo dall'anno di nascita, non dal giorno:
cambiando giorno e mese ma non l'anno, tutti i risultati attesi restano identici.

I file veri (`reference.json`, `wise_iscritti.xlsx`) restano sul tuo computer e
non entrano nel repository. Per rigenerare gli anonimizzati:

```bash
npm run dati
```

Lo script si autoverifica e si rifiuta di produrre dati sbagliati: controlla che
le categorie ricalcolate coincidano, che nessun nome vero sopravviva, e che
l'omonimia voluta sia conservata.

---

## Com'è fatto il progetto

```
index.html                    la app pubblicata sul sito
dist/CronoStrada.html         copia identica, per la chiavetta USB (offline)
README.md                     questo file

manifest.webmanifest          rende la app installabile sul telefono
sw.js                         fa partire la app senza rete (service worker)
icone/                        le icone: SVG di partenza e PNG generati

reference_anon.json           dati di test anonimizzati (280 iscritti, 265 arrivi)
wise_iscritti_anon.xlsx       export WISE anonimizzato, per il test di importazione
test/                         i test automatici
tools/anonimizza.py           genera i dati anonimi da quelli veri
tools/mutazioni.js            rompe la app di proposito per collaudare i test
tools/schermate.js            genera gli screenshot su iPhone e Android
tools/serve.js                server statico minimo, usato solo dai test
package.json                  comandi npm (npm test)

.github/workflows/deploy.yml     test + pubblicazione a ogni modifica
.github/workflows/mutazioni.yml  prova della rete di sicurezza, una volta a settimana
.gitignore                       cosa non finisce nel repository
```

### I comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | I test automatici (computer, iPhone, Android) |
| `npm run mutazioni` | Rompe la app di proposito e controlla che i test se ne accorgano |
| `npm run versione` | Allinea la versione della app installata dopo una modifica |
| `npm run icone` | Rigenera i PNG delle icone dagli SVG |
| `npm run qr` | Ridisegna il codice QR del menu se cambia l'indirizzo del sito |
| `npm run schermate` | Genera gli screenshot su iPhone e Android |
| `npm run dati` | Rigenera i dati di test anonimizzati da quelli veri |
| `npm run browser` | Scarica i browser dei test (la prima volta) |

**Statico puro, per scelta.** Nessun framework, nessun bundler, nessun passaggio
di compilazione. `index.html` contiene tutto: struttura, aspetto e logica, senza
un solo file esterno e senza una sola richiesta di rete. Aprendolo con un doppio
clic funziona esattamente come funziona online.

Non è pigrizia tecnica, è la specifica: una app che al traguardo deve partire
sempre non può dipendere da una rete, da un server o da una libreria scaricata da
qualche parte.

Anche l'importazione dei file `.xlsx` è scritta dentro la app — decompressione
del file e lettura dell'XML compresi — proprio per non dover caricare una
libreria esterna.

**Dati non versionati.** I file con i dati reali degli atleti (`reference.json`,
`wise_iscritti.xlsx`) sono esclusi dal repository di proposito: contengono nomi e
date di nascita di persone vere e il repository è pubblico. Restano sul computer.

**Statico anche da installata.** Il service worker mette in cache soltanto
sette file — la pagina, il manifest e le icone — e nient'altro: i dati di
prova e gli strumenti di sviluppo non finiscono sul telefono di nessuno. E la
app non dipende dal service worker per funzionare: se manca, come succede
aprendo il file dalla chiavetta, gira identica.

### Cosa non c'è ancora

- **Due postazioni che scrivono sulla stessa gara nello stesso momento.** Oggi
  il verso è uno solo: aprire una gara la scarica, e da quel momento la manda su
  questo dispositivo. Il caso di due postazioni insieme si affronterà quando
  servirà davvero, cioè con il giudice arrivi.
Sono i passaggi successivi, previsti e nell'ordine giusto.
