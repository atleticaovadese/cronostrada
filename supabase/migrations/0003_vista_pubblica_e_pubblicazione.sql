-- =====================================================================
-- CronoStrada — la porta d'ingresso Live (pubblica, in sola lettura)
-- =====================================================================
-- Due viste, con l'elenco delle colonne scritto per esteso e mai un
-- "select *": se un domani si aggiunge una colonna sensibile a monte, non
-- compare qui da sola.
--
-- security_invoker = on: la vista non ha poteri suoi, si comporta come chi
-- la interroga. Il pubblico vede quello che l'RLS gli concede e nulla di
-- più, e non c'è il rischio classico delle viste "security definer" che
-- scavalcano in silenzio le politiche delle tabelle sottostanti.
-- =====================================================================

create view cronostrada.live_gare with (security_invoker = on) as
select
  g.id,
  g.nome,
  g.data,
  g.luogo,
  g.km,
  g.organizzatore,
  g.in_corso,
  g.risultati_aggiornati_il
from cronostrada.gare g
where g.pubblicata;

comment on view cronostrada.live_gare is
  'Elenco pubblico delle gare pubblicate. Nessun proprietario, nessuna configurazione.';


create view cronostrada.live_risultati with (security_invoker = on) as
select
  r.gara_id,
  r.pos,
  r.pett,
  r.cognome,
  r.nome,
  r.societa,
  r.fascia,
  r.etichetta,
  r.tempo_ms
from cronostrada.risultati_pubblici r
join cronostrada.gare g on g.id = r.gara_id
where g.pubblicata;

comment on view cronostrada.live_risultati is
  'Classifica pubblica. Posizione, pettorale, cognome, nome, società, fascia, tempo. Nessuna data di nascita: la colonna non esiste nemmeno nella tabella sottostante.';

grant select on cronostrada.live_gare      to anon, authenticated;
grant select on cronostrada.live_risultati to anon, authenticated;


-- =====================================================================
-- Pubblicazione della fotografia
-- =====================================================================
-- Sostituisce l'INTERA classifica in una sola transazione.
--
-- Perché non un upsert: se dopo aver pubblicato si annulla un arrivo o si
-- squalifica un atleta, con l'upsert quella riga resterebbe lì e il
-- pubblico continuerebbe a vedere in classifica qualcuno che non c'è più.
-- Cancella-e-reinserisci nella stessa transazione non lascia fantasmi, e
-- grazie a MVCC chi legge nel frattempo vede la vecchia classifica intera
-- o la nuova intera, mai una lista a metà.
--
-- security invoker: la funzione non ha poteri propri. L'RLS decide, quindi
-- si può pubblicare solo sulle proprie gare.
create or replace function cronostrada.pubblica_risultati(
  p_gara  uuid,
  p_righe jsonb
) returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  delete from cronostrada.risultati_pubblici where gara_id = p_gara;

  insert into cronostrada.risultati_pubblici
    (gara_id, pett, pos, cognome, nome, societa, fascia, etichetta, tempo_ms)
  select
    p_gara, x.pett, x.pos,
    coalesce(x.cognome, ''), coalesce(x.nome, ''), coalesce(x.societa, ''),
    coalesce(x.fascia, ''), coalesce(x.etichetta, ''), x.tempo_ms
  from jsonb_to_recordset(p_righe) as x(
    pett int, pos int, cognome text, nome text,
    societa text, fascia text, etichetta text, tempo_ms bigint
  );

  get diagnostics n = row_count;

  update cronostrada.gare
     set risultati_aggiornati_il = now()
   where id = p_gara;

  return n;
end $$;

-- In Postgres una funzione nasce eseguibile da chiunque: qui si toglie e
-- si concede solo all'organizzatore. Il pubblico non pubblica niente.
revoke all on function cronostrada.pubblica_risultati(uuid, jsonb) from public;
grant execute on function cronostrada.pubblica_risultati(uuid, jsonb) to authenticated;

revoke all on function cronostrada.marca_aggiornamento() from public;
revoke all on function cronostrada.marca_creazione()     from public;
