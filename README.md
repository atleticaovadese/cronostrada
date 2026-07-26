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
| **Traguardo** | Il cronometro e la registrazione degli arrivi. È la schermata della gara. |
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
8. Vai sulla scheda **Traguardo** e lasciala lì.
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

Da qui GitHub fa il resto: entro un minuto o due il sito è aggiornato. Puoi
seguire la pubblicazione dalla scheda **Actions** del repository — pallino verde
significa fatto, pallino rosso significa che qualcosa non è andato e il sito è
rimasto alla versione precedente (che è il comportamento giusto: non pubblica
qualcosa di rotto).

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

## Com'è fatto il progetto

```
index.html                    la app pubblicata sul sito
dist/CronoStrada.html         copia identica, per la chiavetta USB (offline)
README.md                     questo file
.github/workflows/deploy.yml  pubblica il sito a ogni modifica
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
