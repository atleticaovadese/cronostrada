# CronoStrada

Programma per cronometrare e classificare le gare podistiche su strada.
Sostituisce il foglio Excel: prende gli iscritti esportati da WISE, cronometra gli
arrivi, calcola categorie e classifiche, stampa le premiazioni e riesporta il CSV
da ricaricare su WISE.

**Indirizzo del sito:** https://atleticaovadese.github.io/cronostrada/

---

## Indice

- [In due parole](#in-due-parole)
- [La cosa più importante da sapere: dove finiscono i dati](#la-cosa-più-importante-da-sapere-dove-finiscono-i-dati)
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

## La cosa più importante da sapere: dove finiscono i dati

CronoStrada salva **nella memoria del browser** del dispositivo che stai usando.
Non su un server. Da qui derivano tre regole che vale la pena leggere una volta
con calma, adesso, e non il giorno della gara.

### Regola 1 — Un dispositivo, una gara

I dati stanno nel browser di **quel** dispositivo. Se registri gli arrivi dal
telefono, sul computer non li vedi. Non c'è ancora sincronizzazione: arriverà,
per adesso non c'è.

**Quindi:** decidi in anticipo quale dispositivo sta al traguardo, e usa solo
quello per tutta la gara.

### Regola 2 — Il sito e la chiavetta sono due memorie diverse

Questa sorprende tutti, quindi te la dico chiara.

Il browser tiene le memorie separate per indirizzo. Aprire il sito
`atleticaovadese.github.io/cronostrada` e aprire il file `CronoStrada.html` dalla
chiavetta sono, per il browser, **due posti diversi**: ognuno ha i suoi dati e non
vede quelli dell'altro.

**Quindi:** se sei partito dal sito e a metà gara passi alla chiavetta, gli arrivi
registrati **non compaiono da soli**. Per spostarli devi passare da un backup:
`Scarica backup .json` da una parte, `Carica backup .json` dall'altra. Vedi
[Quando qualcosa va storto](#quando-qualcosa-va-storto).

### Regola 3 — Il backup non è facoltativo

Svuotare la cronologia del browser, la navigazione in incognito, o un "pulisci i
dati dei siti" fatto per abitudine: ognuna di queste cose cancella la gara.

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

### Gli arrivi

Hai due modi, e puoi mescolarli liberamente durante la gara.

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

**3. Manda su GitHub:**

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

Ogni volta che si manda una modifica su GitHub, **17 test verificano da soli**
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

reference_anon.json           dati di test anonimizzati (280 iscritti, 265 arrivi)
wise_iscritti_anon.xlsx       export WISE anonimizzato, per il test di importazione
test/                         i test automatici
tools/anonimizza.py           genera i dati anonimi da quelli veri
tools/serve.js                server statico minimo, usato solo dai test
package.json                  comandi npm (npm test)

.github/workflows/deploy.yml  test + pubblicazione a ogni modifica
.gitignore                    cosa non finisce nel repository
```

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

### Cosa non c'è ancora

- Sincronizzazione fra dispositivi
- Installazione come app sul telefono, con funzionamento offline garantito
- Più postazioni sulla stessa gara

Sono i passaggi successivi, previsti e nell'ordine giusto.
