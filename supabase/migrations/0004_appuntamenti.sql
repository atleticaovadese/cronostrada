-- =====================================================================
-- CronoStrada — Prossimi appuntamenti: locandine e volantini
-- =====================================================================
-- Un posto dove l'organizzatore appende le locandine delle gare in arrivo
-- e chiunque le può guardare, senza account e senza installare niente.
--
-- ATTENZIONE, come sempre in questo progetto: qui dentro vive anche la app
-- presenze, che ha un suo bucket "profili" e 67 account. Tutte le politiche
-- qui sotto sono legate a bucket_id = 'appuntamenti' e non concedono nulla
-- su nient'altro: una politica che nomina un bucket solo non può aprire il
-- bucket di un altro.
--
-- Prima di questa migrazione storage.objects aveva RLS attiva e ZERO
-- politiche, cioè era chiuso a tutti e la app presenze ci arriva per altra
-- strada. Queste sono le prime, e sono in aggiunta: quello che era chiuso
-- resta chiuso.
-- =====================================================================

-- --------------------------------------------------------------- bucket
-- public = true: i file si aprono con il loro indirizzo, senza token. È
-- quello che serve — una locandina la si manda anche su WhatsApp.
-- Il tetto e i tipi li fa rispettare lo Storage, prima ancora dell'RLS:
-- niente video, niente eseguibili, niente PDF da cinquanta mega che dal
-- telefono in 4G non si aprono.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appuntamenti', 'appuntamenti', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ------------------------------------------------------- chi può appendere
-- Chi organizza gare, cioè chi possiede almeno una riga in cronostrada.gare.
--
-- Perché non "chiunque abbia fatto l'accesso": gli account di questo
-- progetto sono in gran parte di un'altra app, e non hanno niente a che
-- vedere con le gare su strada. Un permesso che segue le gare non ha
-- bisogno di elenchi da tenere aggiornati a mano.
--
-- SECURITY INVOKER (il valore predefinito, scritto qui per non lasciarlo
-- sottinteso): la funzione non ha poteri suoi. La sottoquery su gare passa
-- a sua volta dalla politica gare_proprie, quindi vede solo le gare di chi
-- sta chiedendo — che è esattamente la domanda che stiamo facendo.
create or replace function cronostrada.organizza_gare()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from cronostrada.gare g where g.proprietario = (select auth.uid())
  );
$$;

revoke all on function cronostrada.organizza_gare() from public;
grant execute on function cronostrada.organizza_gare() to authenticated;


-- ------------------------------------------------------------ politiche
-- LEGGERE: tutti, anche senza accesso. È il senso della sezione.
create policy appuntamenti_leggi on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'appuntamenti');

-- APPENDERE: solo chi organizza gare.
create policy appuntamenti_appendi on storage.objects
  for insert to authenticated
  with check (bucket_id = 'appuntamenti' and cronostrada.organizza_gare());

-- TOGLIERE: idem. Nessuna politica di UPDATE: un file non si modifica, si
-- toglie e si rimette. Così non si può cambiare la locandina sotto il naso
-- di chi ha già l'indirizzo in mano.
create policy appuntamenti_togli on storage.objects
  for delete to authenticated
  using (bucket_id = 'appuntamenti' and cronostrada.organizza_gare());
