-- =====================================================================
-- CronoStrada — Row Level Security e permessi
-- =====================================================================
-- ATTENZIONE: ogni concessione e ogni revoca qui dentro è limitata allo
-- schema cronostrada. Questo progetto ospita anche l'app presenze, con 43
-- tabelle in "public": un "revoke ... on all tables in schema public"
-- gliela romperebbe. Non compare, e non deve mai comparire.
--
-- Le serrature sull'anagrafica sono tre e indipendenti:
--   1. nessuna politica RLS per anon su iscritti  -> zero righe
--   2. privilegi revocati per anon su iscritti    -> errore di permesso
--   3. la data di nascita non esiste in nessuna tabella o vista che il
--      pubblico possa raggiungere
--
-- Per scrivere, anon non ha NESSUNA politica di INSERT, UPDATE o DELETE
-- su NESSUNA tabella, e i privilegi di scrittura sono revocati in blocco.
-- =====================================================================

-- RLS attiva e FORZATA ovunque: forzata significa che nemmeno chi possiede
-- le tabelle la scavalca.
alter table cronostrada.gare               enable row level security;
alter table cronostrada.gare               force  row level security;
alter table cronostrada.configurazione     enable row level security;
alter table cronostrada.configurazione     force  row level security;
alter table cronostrada.fasce              enable row level security;
alter table cronostrada.fasce              force  row level security;
alter table cronostrada.iscritti           enable row level security;
alter table cronostrada.iscritti           force  row level security;
alter table cronostrada.arrivi             enable row level security;
alter table cronostrada.arrivi             force  row level security;
alter table cronostrada.arrivi_correzioni  enable row level security;
alter table cronostrada.arrivi_correzioni  force  row level security;
alter table cronostrada.ritiri             enable row level security;
alter table cronostrada.ritiri             force  row level security;
alter table cronostrada.risultati_pubblici enable row level security;
alter table cronostrada.risultati_pubblici force  row level security;


-- =====================================================================
-- ORGANIZZATORE (ruolo authenticated): tutto, ma solo sulle gare proprie
-- =====================================================================

create policy gare_proprie on cronostrada.gare
  for all to authenticated
  using      (proprietario = (select auth.uid()))
  with check (proprietario = (select auth.uid()));

-- Le tabelle figlie si appoggiano alla gara. La sottoquery su gare è a sua
-- volta soggetta alla politica qui sopra: doppio controllo, non uno.
create policy configurazione_propria on cronostrada.configurazione
  for all to authenticated
  using      (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())))
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy fasce_proprie on cronostrada.fasce
  for all to authenticated
  using      (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())))
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy iscritti_propri on cronostrada.iscritti
  for all to authenticated
  using      (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())))
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy ritiri_propri on cronostrada.ritiri
  for all to authenticated
  using      (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())))
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy risultati_propri on cronostrada.risultati_pubblici
  for all to authenticated
  using      (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())))
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

-- ------------------------------------------------- arrivi: solo nascere
-- Nessuna politica di UPDATE. Nessuna politica di DELETE. Senza politica
-- l'operazione è negata anche al proprietario: è così che l'immutabilità
-- smette di essere una promessa e diventa una regola del database.
create policy arrivi_leggi on cronostrada.arrivi
  for select to authenticated
  using (exists (select 1 from cronostrada.gare g
                 where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy arrivi_inserisci on cronostrada.arrivi
  for insert to authenticated
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy correzioni_leggi on cronostrada.arrivi_correzioni
  for select to authenticated
  using (exists (select 1 from cronostrada.gare g
                 where g.id = gara_id and g.proprietario = (select auth.uid())));

create policy correzioni_inserisci on cronostrada.arrivi_correzioni
  for insert to authenticated
  with check (exists (select 1 from cronostrada.gare g
                      where g.id = gara_id and g.proprietario = (select auth.uid())));


-- =====================================================================
-- PUBBLICO (ruolo anon): solo lettura, solo gare pubblicate, solo risultati
-- =====================================================================
-- Nessuna politica di scrittura, da nessuna parte. Nessuna politica su
-- iscritti, configurazione, fasce, arrivi, arrivi_correzioni, ritiri:
-- per il pubblico quelle tabelle non esistono.

create policy gare_pubblicate_anon on cronostrada.gare
  for select to anon
  using (pubblicata);

create policy risultati_pubblicati_anon on cronostrada.risultati_pubblici
  for select to anon
  using (exists (select 1 from cronostrada.gare g
                 where g.id = gara_id and g.pubblicata));


-- =====================================================================
-- PRIVILEGI — tutti limitati allo schema cronostrada
-- =====================================================================

grant usage on schema cronostrada to anon, authenticated;

-- L'organizzatore può tutto; a decidere cosa vede è l'RLS qui sopra.
grant select, insert, update, delete on all tables in schema cronostrada to authenticated;

-- Tranne che sugli arrivi: immutabili anche a livello di privilegi, così
-- l'immunità non dipende soltanto dall'assenza di una politica.
revoke update, delete on cronostrada.arrivi            from authenticated;
revoke update, delete on cronostrada.arrivi_correzioni from authenticated;

-- Il pubblico parte da zero.
revoke all on all tables in schema cronostrada from anon;

-- E riceve soltanto questo:
--  - di gare, le colonne che stanno su una locandina (niente proprietario)
grant select (id, nome, data, luogo, km, organizzatore, pubblicata,
              in_corso, risultati_aggiornati_il)
  on cronostrada.gare to anon;
--  - i risultati, che non contengono niente di personale oltre al nome
grant select on cronostrada.risultati_pubblici to anon;

-- Le tabelle create in futuro in questo schema partiranno senza privilegi
-- per anon, invece di ereditarli per distrazione.
alter default privileges in schema cronostrada revoke all on tables from anon;
