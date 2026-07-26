# CronoStrada — prompt per Claude Code

Guida operativa per portare online la app, renderla installabile sul telefono e
sincronizzarla tra più dispositivi.

I prompt vanno dati **in ordine, uno alla volta**. Dopo ognuno provi il risultato:
se qualcosa non va, lo dici a Claude Code prima di passare al successivo. Non
incollarli tutti insieme.

---

## Prima di cominciare

**Cosa ti serve** (10 minuti, una volta sola):

1. Un account **GitHub** — https://github.com/signup (gratis)
2. Un account **Supabase** — https://supabase.com (gratis, serve per la sincronizzazione)
3. **Claude Code** installato sul tuo computer
4. I tre file che ti ho consegnato, messi tutti in una cartella nuova, ad esempio `Documenti/cronostrada`:
   - `CronoStrada.html` — la app attuale
   - `reference.json` — i dati veri della Stradolcetto 2025 (280 iscritti, 265 arrivi), servono per i test
   - `wise_iscritti.xlsx` — un export WISE di esempio per provare l'importazione

Poi apri il terminale in quella cartella e lanci `claude`.

**Una regola sopra tutte:** non provare mai una versione nuova il giorno della
gara. Tieni sempre da parte il file `CronoStrada.html` che già funziona, su una
chiavetta USB. È la tua rete di sicurezza.

---

## Prompt 1 — Metti la app online

> Nella cartella corrente c'è `CronoStrada.html`, una applicazione a file singolo
> per cronometrare gare podistiche su strada. Funziona già: leggila prima di
> toccare qualsiasi cosa, così capisci com'è fatta.
>
> Voglio pubblicarla come sito su GitHub Pages, senza cambiare per ora una riga
> del suo comportamento.
>
> Fai questo:
> 1. Inizializza un repository git in questa cartella e crea `.gitignore` adatto
>    (escludi `node_modules`, `.env`, `.DS_Store`, i file di test locali).
> 2. Crea la struttura del sito: `index.html` come copia esatta di
>    `CronoStrada.html`, e sposta `CronoStrada.html` in `dist/` come versione di
>    emergenza da usare offline da chiavetta USB.
> 3. Scrivi un `README.md` in italiano che spieghi a una persona non tecnica cosa
>    fa la app, come si usa il giorno della gara e come si aggiorna il sito.
> 4. Configura il deploy su GitHub Pages con GitHub Actions (workflow in
>    `.github/workflows/deploy.yml`) che pubblichi il contenuto della root a ogni
>    push sul branch `main`.
> 5. Guidami passo passo, con comandi da copiare, per: creare il repository su
>    GitHub, collegarlo, fare il primo push e attivare Pages nelle impostazioni.
>    Chiedimi tu i dati che ti servono (nome utente GitHub, nome del repository)
>    invece di inventarli.
>
> Vincoli:
> - Il sito deve restare **statico puro**: niente framework, niente bundler,
>   niente passaggio di build. Deve funzionare aprendo il file anche senza server.
> - Non cambiare la logica di calcolo, i tempi o l'aspetto. Questo passaggio è
>   solo messa online.
>
> Alla fine dimmi l'indirizzo pubblico del sito e verifica tu stesso che risponda.

**Come verifichi:** apri l'indirizzo dal telefono e dal computer. Devi vedere la
app identica a quella che hai già.

---

## Prompt 2 — Rete di sicurezza: test automatici

Questo passaggio non aggiunge funzioni, ma è il più importante di tutti: da qui
in poi ogni modifica viene verificata sui dati veri di una gara reale, e se
qualcosa si rompe lo scopri subito invece che al traguardo.

> Nella cartella c'è `reference.json`: contiene i dati reali di una gara già
> disputata (7ª Stradolcetto, 280 iscritti e 265 arrivi) con, per ogni atleta, la
> categoria e la posizione calcolate dal foglio Excel che questa app sostituisce.
> Sono la verità di riferimento.
>
> Prepara una suite di test automatici con Playwright che carica la app, le
> inietta questi dati e verifica che produca **esattamente** gli stessi risultati:
>
> 1. le 280 categorie FIDAL (campo `catFidal`)
> 2. le 280 fasce di premiazione (campo `catGara`)
> 3. le 265 posizioni assolute (campo `posAss`)
> 4. le 265 etichette di posizione di categoria (campo `etich`), che includono
>    l'esclusione dei primi tre assoluti maschili e femminili dalla loro categoria
> 5. i conteggi: 269 confermati, 11 DNS, 4 DNF, 51 società
> 6. il CSV per WISE: il primo tempo deve risultare `33:59` e non `34:00`, perché
>    i tempi si **troncano** al secondo, non si arrotondano. Questo è un requisito
>    di regolamento, non una preferenza.
>
> Aggiungi anche test funzionali su: importazione di `wise_iscritti.xlsx` con
> riconoscimento automatico delle colonne, registrazione di un arrivo con e senza
> pettorale, STOP e ripresa del cronometro, spostamento dell'orario di partenza
> (tutti i tempi devono traslare della stessa quantità e l'ordine di arrivo non
> deve cambiare), azzeramento, e persistenza dei dati dopo un ricaricamento della
> pagina.
>
> Il test deve fallire con un messaggio chiaro e in italiano che dica quale
> atleta e quale valore non torna. Aggiungilo come `npm test` e fallo girare
> anche nel workflow di GitHub Actions, bloccando il deploy se fallisce.
>
> Fai girare i test adesso e mostrami il risultato.

**Come verifichi:** deve dirti che tutto corrisponde. Se un test fallisce subito,
c'è un problema da capire prima di andare avanti.

---

## Prompt 3 — App installabile sul telefono

> Trasforma il sito in una PWA installabile, che funzioni completamente offline.
>
> 1. `manifest.webmanifest` con nome "CronoStrada", nome breve "CronoStrada",
>    apertura a schermo intero (`display: standalone`), orientamento libero,
>    colore tema scuro coerente con il pannello del cronometro.
> 2. Icone generate da te in tutte le misure necessarie (192, 512, maskable, più
>    l'icona per iOS): un cronometro stilizzato, sfondo scuro, leggibile anche
>    piccola. Generale come SVG e convertile in PNG.
> 3. Un service worker che metta in cache tutti i file della app con strategia
>    **cache-first** per il codice: al traguardo la app deve partire in un secondo
>    anche con il telefono in modalità aereo.
> 4. Gestione degli aggiornamenti: quando esce una versione nuova, mostra un
>    avviso discreto "È disponibile una versione aggiornata — Ricarica" invece di
>    aggiornare da solo. **Non deve mai ricaricarsi da sola mentre la gara è in
>    corso**: se `S.start` è valorizzato e `S.stop` no, l'aggiornamento va
>    rimandato in silenzio.
> 5. Un pulsante "Installa sul telefono" visibile solo quando il browser lo
>    consente, con istruzioni per iPhone (dove va fatto a mano da Condividi →
>    Aggiungi a Home).
>
> Attenzione: la app oggi salva in `localStorage`. Verifica che continui a
> funzionare identica quando è installata come PWA, e che i dati non si perdano
> passando da browser a app installata.
>
> Aggiorna i test per coprire l'installabilità e il funzionamento offline
> (Playwright sa simulare la rete assente).

**Come verifichi:** apri il sito dal telefono, aggiungilo alla schermata home,
attiva la modalità aereo e riaprilo. Deve funzionare tutto.

---

## Prompt 4 — Database e sincronizzazione

Qui la app smette di vivere solo dentro un browser. È il passaggio più delicato:
va fatto con calma e provato bene.

> Aggiungi la sincronizzazione su Supabase, mantenendo il funzionamento offline
> assolutamente intatto.
>
> **Il principio da non tradire mai:** il dispositivo al traguardo è la fonte di
> verità. Ogni arrivo viene scritto prima in locale e solo dopo, quando e se c'è
> rete, inviato al server. Nessuna operazione della app deve mai aspettare una
> risposta dalla rete, né fallire perché la rete manca. La sincronizzazione è uno
> specchio, non una dipendenza.
>
> Cosa serve:
>
> 1. **Schema.** Progetta le tabelle su Supabase: gare, iscritti, arrivi,
>    configurazione, stati DNS/DNF. Gli arrivi devono essere righe singole con
>    identificativo generato dal client (UUID), non un blob unico, altrimenti due
>    dispositivi che registrano nello stesso momento si sovrascrivono a vicenda.
>    Ogni riga porta con sé chi l'ha creata e quando.
> 2. **Coda di uscita.** Le modifiche fatte offline finiscono in una coda
>    persistente (IndexedDB) e vengono inviate quando torna la rete, in ordine e
>    in modo idempotente: se una richiesta viene rimandata due volte non deve
>    creare doppioni.
> 3. **Risoluzione dei conflitti.** Per gli arrivi non deve esistere conflitto:
>    ogni riga è nuova e immutabile una volta creata, le correzioni sono modifiche
>    esplicite tracciate. Per iscritti e configurazione vale l'ultima modifica,
>    ma dimmi tu se vedi casi in cui questo perde dati.
> 4. **Accesso.** Attiva **Row Level Security su tutte le tabelle**, senza
>    eccezioni. La chiave pubblica anon finisce nel codice del sito — è normale e
>    previsto — ma con RLS attiva non permette di leggere o scrivere le gare di
>    altri. La chiave `service_role` non deve comparire da nessuna parte nel
>    codice del sito: se la vedi in un file destinato al browser, fermati e
>    dimmelo.
> 5. **Indicatore di stato.** In alto nella app deve sempre essere chiaro se i
>    dati sono solo in locale, in corso di invio o allineati, con il numero di
>    modifiche ancora in coda.
> 6. **Ripiego.** Se Supabase non risponde o non è configurato, la app deve
>    funzionare esattamente come oggi, senza un solo messaggio d'errore che
>    spaventi chi è al traguardo.
>
> Guidami nella creazione del progetto Supabase e nella configurazione, chiedendo
> tu i dati che servono. Usa le migrazioni SQL versionate nel repository, non
> modifiche fatte a mano dalla console.
>
> Prima di scrivere codice, mostrami lo schema proposto e le politiche RLS, e
> aspetta che ti dica di procedere.

**Come verifichi:** registra qualche arrivo con il telefono in modalità aereo,
poi riattiva la rete: devono comparire sul server senza duplicati. Poi apri la
stessa gara da un altro dispositivo e controlla che li veda.

---

## Prompt 5 — Più postazioni sulla stessa gara

Questo è il passaggio che prepara il terreno per il **giudice arrivi**.

> Ora che la sincronizzazione funziona, permetti a più dispositivi di lavorare
> sulla stessa gara contemporaneamente.
>
> 1. **Invito.** Chi crea la gara genera un codice o un QR con cui un altro
>    dispositivo entra nella stessa gara, con un ruolo assegnato.
> 2. **Ruoli.** Almeno tre: chi organizza (vede e modifica tutto), chi registra
>    gli arrivi (vede solo la schermata arrivi), chi consulta (sola lettura, per
>    esporre le classifiche al pubblico).
> 3. **Tempo reale.** Usa le sottoscrizioni realtime di Supabase perché gli
>    arrivi registrati da un dispositivo compaiano sugli altri entro un paio di
>    secondi, senza ricaricare.
> 4. **Doppia registrazione.** Se due postazioni registrano lo stesso pettorale,
>    la app deve segnalarlo con evidenza e permettere di scegliere quale tempo
>    tenere, senza cancellare l'altro finché non decido io.
> 5. **Divergenza.** Mostra sempre, per ogni dispositivo, quanti arrivi ha in
>    locale e quanti ne risultano sul server: se i numeri divergono deve essere
>    visibile a colpo d'occhio.
>
> Aggiungi test che simulano due dispositivi contemporanei, compreso il caso in
> cui uno dei due va offline a metà gara e torna dopo venti minuti.

---

## Prompt 6 — Giudice arrivi

Da usare **dopo** avermi passato l'artefatto "giudice arrivi", che ancora non ho
visto. Tienilo da parte per adesso.

> Ti allego l'artefatto "giudice arrivi". Leggilo, spiegami cosa fa e come si
> incastra con CronoStrada, e proponimi due o tre modi di integrarlo prima di
> scrivere codice. Mi aspetto che tu mi dica anche cosa si sovrappone con quello
> che la app fa già e cosa invece è nuovo.

---

## Prompt 7 — Rifiniture, quando avrai fatto qualche gara

Da usare solo dopo aver usato la app sul campo un paio di volte.

> Sulla base di come ho usato la app in gara, sistemiamo queste cose: [scrivi qui
> i fastidi che hai incontrato, anche in disordine].
>
> Inoltre valuta:
> - stampa dei risultati e delle premiazioni in PDF con intestazione della gara,
>   logo e firma del medico
> - una pagina pubblica di sola lettura con le classifiche, da proiettare o da
>   condividere via link con gli atleti
> - un dominio personalizzato al posto dell'indirizzo github.io
> - impacchettare la PWA con Capacitor per pubblicarla sugli store, se a quel
>   punto ti sembra ancora utile

---

## Consigli per lavorare bene con Claude Code

**Una cosa per volta.** Un prompt, una prova, poi il successivo. Se ne accumuli
tre e qualcosa si rompe, non sai più quale è stato.

**Fai commit spesso.** Chiedi "fai un commit con un messaggio chiaro" dopo ogni
passaggio riuscito. Così puoi sempre tornare a una versione che funzionava.

**Chiedi prima di far fare.** Su cose delicate (schema del database, modifiche ai
calcoli) scrivi *"prima spiegami cosa hai intenzione di fare e aspetta il mio ok"*.
Costa trenta secondi e ti evita sorprese.

**Se una cosa non ti torna, dillo con parole tue.** Non serve il linguaggio
tecnico: "quando premo spazio due volte veloce ne registra uno solo" è una
segnalazione perfetta.

**Difendi i tempi.** Se in una risposta vedi comparire arrotondamenti, fusi orari
o orari assoluti al posto dei millisecondi dallo start, fermati e chiedi
spiegazioni. È lì che si nascondono gli errori che si notano solo a premiazione
già fatta.
