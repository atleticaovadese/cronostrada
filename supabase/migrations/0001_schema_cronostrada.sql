-- =====================================================================
-- CronoStrada — schema, tabelle, vincoli
-- =====================================================================
-- Tutto vive in uno schema suo. Questo progetto Supabase ospita già una
-- app con 43 tabelle in "public": niente di ciò che segue tocca quelle,
-- e nessuna concessione o revoca esce da questo schema.
--
-- I due principi che decidono la forma delle tabelle:
--
-- 1. GLI ARRIVI SONO IMMUTABILI. Nascono con un identificativo generato
--    dal dispositivo e non vengono mai modificati né cancellati. Due
--    dispositivi che premono nello stesso istante producono due righe
--    diverse: il conflitto non esiste per costruzione.
--    Le correzioni sono righe nuove in arrivi_correzioni.
--    Lo spostamento della partenza è un numero solo in configurazione.
--    L'azzeramento è un contatore di sessione, sempre in configurazione.
--    Nessuna di queste tre operazioni riscrive una riga di arrivi.
--
-- 2. L'ANAGRAFICA NON ENTRA NEL PERCORSO PUBBLICO. La data di nascita
--    esiste solo in cronostrada.iscritti, che il ruolo anonimo non può
--    raggiungere in alcun modo. La tabella dei risultati pubblici non ha
--    proprio la colonna: non c'è niente da proteggere perché non c'è.
-- =====================================================================

create schema if not exists cronostrada;

-- Niente privilegi impliciti: si concede solo ciò che serve, in 0002.
revoke all on schema cronostrada from public;


-- ---------------------------------------------------------------- gare
create table cronostrada.gare (
  id            uuid primary key,              -- generato dal dispositivo
  proprietario  uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  nome          text not null default '',
  data          date,
  luogo         text not null default '',
  km            numeric(6,3),
  anno          int,
  organizzatore text not null default '',

  -- La pubblicazione in Live è una scelta esplicita, spenta di default,
  -- e si può ritirare in qualsiasi momento rimettendola a false.
  pubblicata    boolean not null default false,
  pubblicata_il timestamptz,

  -- Mantenuto dalla app su START e STOP. Sta qui e non in configurazione
  -- perché il pubblico deve poterlo leggere, e configurazione al pubblico
  -- non è raggiungibile.
  in_corso      boolean not null default false,

  risultati_aggiornati_il timestamptz,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
comment on table cronostrada.gare is
  'Una gara. Il proprietario è l''unico che la vede e la modifica; il pubblico anonimo la vede solo se pubblicata = true.';


-- ------------------------------------------------------- configurazione
create table cronostrada.configurazione (
  gara_id            uuid primary key
                     references cronostrada.gare(id) on delete cascade,
  premi_ass_f        int not null default 3,
  premi_ass_m        int not null default 3,
  premi_cat          int not null default 3,
  premi_soc          int not null default 3,
  societa_escluse    text[] not null default array['RUNCARD'],

  -- Orario dello sparo, come risulta adesso.
  partenza_ms        bigint,
  stop_ms            bigint,

  -- SPOSTAMENTO DELLA PARTENZA, in millisecondi, con segno.
  -- arrivi.ms è la misura grezza fatta dal dispositivo rispetto alla
  -- partenza ORIGINALE e non cambia mai. Spostare la partenza cambia
  -- questo numero e nient'altro:
  --     tempo effettivo = arrivi.ms - scarto_partenza_ms
  -- Il dispositivo continua a lavorare sui tempi già traslati; è il
  -- livello di sincronizzazione a convertire, in invio e in lettura.
  scarto_partenza_ms bigint not null default 0,

  -- AZZERAMENTO. "Azzera" cancella gli arrivi sul dispositivo, ma sul
  -- server non si cancella niente: si incrementa questo contatore e le
  -- righe delle sessioni precedenti smettono di contare, restando come
  -- traccia di cosa è stato scartato (per esempio una falsa partenza).
  sessione           int not null default 1,

  aggiornato_il      timestamptz not null default now(),
  dispositivo        text
);


-- --------------------------------------------------------------- fasce
-- Una riga per fascia invece di un blob unico: due persone che modificano
-- fasce diverse non si sovrascrivono più a vicenda.
create table cronostrada.fasce (
  id            uuid primary key,
  gara_id       uuid not null references cronostrada.gare(id) on delete cascade,
  nome          text not null,                 -- 'SM45', 'JPSF', …
  fidal         text[] not null default '{}',  -- le categorie accorpate
  premi         int,
  ordine        int not null default 0,
  eliminata     boolean not null default false,
  aggiornato_il timestamptz not null default now(),
  dispositivo   text
);
create index fasce_gara on cronostrada.fasce (gara_id);


-- ------------------------------------------------------------ iscritti
-- L'UNICA tabella con la data di nascita. Vedi le politiche in 0002.
create table cronostrada.iscritti (
  id            uuid primary key,
  gara_id       uuid not null references cronostrada.gare(id) on delete cascade,
  pett          int,
  cognome       text not null default '',
  nome          text not null default '',
  sesso         text,
  societa       text not null default '',
  nascita       date,                          -- MAI leggibile da anonimo
  conferma      boolean not null default true, -- false = DNS
  eliminato     boolean not null default false,-- lapide, non cancellazione
  aggiornato_il timestamptz not null default now(),
  dispositivo   text
);
create index iscritti_gara on cronostrada.iscritti (gara_id);
create unique index iscritti_pettorale on cronostrada.iscritti (gara_id, pett)
  where pett is not null and not eliminato;


-- -------------------------------------------------------------- arrivi
-- IMMUTABILI. Nessuna politica di UPDATE o DELETE esiste per questa
-- tabella, e i privilegi corrispondenti sono revocati (vedi 0002).
create table cronostrada.arrivi (
  id          uuid primary key,                -- generato dal dispositivo
  gara_id     uuid not null references cronostrada.gare(id) on delete cascade,
  sessione    int not null default 1,
  ms          bigint not null,                 -- grezzo, dalla partenza originale
  dispositivo text not null default '',
  creato_il   timestamptz not null default now()
);
create index arrivi_gara on cronostrada.arrivi (gara_id, sessione);
comment on column cronostrada.arrivi.ms is
  'Millisecondi dalla partenza ORIGINALE. Immutabile. Il tempo effettivo è ms - configurazione.scarto_partenza_ms.';


-- --------------------------------------------------- arrivi_correzioni
-- Solo aggiunte. Lo stato effettivo di un arrivo è l'arrivo più la sua
-- correzione più recente. Così resta la storia di chi ha corretto cosa.
create table cronostrada.arrivi_correzioni (
  id          uuid primary key,
  gara_id     uuid not null references cronostrada.gare(id) on delete cascade,
  arrivo_id   uuid not null references cronostrada.arrivi(id) on delete cascade,
  pett        int,                             -- null = ancora senza pettorale
  corr_s      int not null default 0,          -- secondi di correzione
  nota        text,
  annullato   boolean not null default false,  -- "elimina" senza cancellare
  dispositivo text,
  creato_il   timestamptz not null default now()
);
create index correzioni_arrivo on cronostrada.arrivi_correzioni (gara_id, arrivo_id, creato_il desc);


-- ------------------------------------------------------------- ritiri
-- DNF, uno per pettorale. I DNS non hanno una tabella: sono gli iscritti
-- con conferma = false, esattamente come nella app.
create table cronostrada.ritiri (
  gara_id       uuid not null references cronostrada.gare(id) on delete cascade,
  pett          int not null,
  ritirato      boolean not null default true,
  aggiornato_il timestamptz not null default now(),
  dispositivo   text,
  primary key (gara_id, pett)
);


-- -------------------------------------------- risultati_pubblici (Live)
-- La fotografia della classifica calcolata dal dispositivo al traguardo.
-- Non si ricalcola niente in SQL: il calcolo delle categorie FIDAL e
-- dell'esclusione degli assoluti è verificato da otto test contro una
-- gara vera, e una seconda copia di quella logica potrebbe divergere in
-- silenzio.
--
-- NIENTE data di nascita, niente conferma, niente anagrafica: solo ciò
-- che si legge su un tabellone.
create table cronostrada.risultati_pubblici (
  gara_id   uuid not null references cronostrada.gare(id) on delete cascade,
  pett      int not null,
  pos       int not null,
  cognome   text not null default '',
  nome      text not null default '',
  societa   text not null default '',
  fascia    text not null default '',
  etichetta text not null default '',
  tempo_ms  bigint not null,
  primary key (gara_id, pett)
);
create index risultati_ordine on cronostrada.risultati_pubblici (gara_id, pos);


-- ------------------------------------------------------------ orologi
-- L'ordine di "vince l'ultima modifica" lo decide il SERVER, non il
-- dispositivo: un telefono con l'ora sbagliata renderebbe la regola una
-- lotteria. Il valore mandato dal client viene ignorato.
create or replace function cronostrada.marca_aggiornamento()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

create or replace function cronostrada.marca_creazione()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.creato_il := now();
  return new;
end $$;

create trigger tocca before insert or update on cronostrada.gare
  for each row execute function cronostrada.marca_aggiornamento();
create trigger tocca before insert or update on cronostrada.configurazione
  for each row execute function cronostrada.marca_aggiornamento();
create trigger tocca before insert or update on cronostrada.fasce
  for each row execute function cronostrada.marca_aggiornamento();
create trigger tocca before insert or update on cronostrada.iscritti
  for each row execute function cronostrada.marca_aggiornamento();
create trigger tocca before insert or update on cronostrada.ritiri
  for each row execute function cronostrada.marca_aggiornamento();

create trigger nasce before insert on cronostrada.arrivi
  for each row execute function cronostrada.marca_creazione();
create trigger nasce before insert on cronostrada.arrivi_correzioni
  for each row execute function cronostrada.marca_creazione();
