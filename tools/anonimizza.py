#!/usr/bin/env python3
"""
Genera i dati di test anonimizzati a partire dai dati reali della gara.

    python tools/anonimizza.py

Ingresso  (NON versionati, restano sul computer):
    reference.json          280 iscritti e 265 arrivi reali della 7a Stradolcetto
    wise_iscritti.xlsx      export WISE reale

Uscita    (versionati nel repository, usati dai test):
    reference_anon.json
    wise_iscritti_anon.xlsx

COSA VIENE SOSTITUITO
    cognome, nome           nomi italiani di fantasia
    data di nascita         giorno e mese cambiati, ANNO CONSERVATO

COSA RESTA AUTENTICO
    pettorale, sesso, societa, conferma
    catFidal, catGara       le categorie attese
    tutti gli arrivi        pettorale, millisecondi, posizioni, etichette

Il vincolo che tiene in piedi tutto: la categoria FIDAL dipende solo
dall'ANNO di nascita (anno di riferimento - anno di nascita), non dal giorno.
Cambiando giorno e mese ma non l'anno, ogni risultato atteso resta identico.

L'OMONIMIA
    Nei dati reali due atleti distinti hanno lo stesso cognome e nome.
    La coppia viene mappata sullo stesso nome di fantasia (VOLPI LUCA) per
    conservare la collisione: e' il caso che il test sugli omonimi deve trovare.

Lo script si autoverifica: se una qualsiasi delle proprieta' sopra non regge,
si ferma con un errore invece di produrre dati sbagliati.
"""

import json
import sys
import zipfile
import datetime
from pathlib import Path
from xml.sax.saxutils import escape

RADICE = Path(__file__).resolve().parent.parent
ANNO_RIFERIMENTO = 2025

# ---------------------------------------------------------------- categorie
# Replica esatta di catFidal() in index.html. Serve per verificare che
# l'anonimizzazione non abbia spostato nessuna categoria.
SOGLIE = [(89, '90'), (84, '85'), (79, '80'), (74, '75'), (69, '70'), (64, '65'),
          (59, '60'), (54, '55'), (49, '50'), (44, '45'), (39, '40'), (34, '35')]


def cat_fidal(sesso, anno_nascita, anno_rif):
    if not anno_nascita or not anno_rif:
        return ''
    s = 'F' if str(sesso).upper().startswith('F') else 'M'
    e = anno_rif - anno_nascita
    for lim, suf in SOGLIE:
        if e > lim:
            return 'S' + s + suf
    if e > 22:
        return 'S' + s
    if e > 19:
        return 'P' + s
    if e > 17:
        return 'J' + s
    if e > 15:
        return 'A' + s
    return 'C' + s


# ---------------------------------------------------------------- nomi finti
# VOLPI e LUCA sono esclusi dai due elenchi: sono riservati alla coppia di
# omonimi, cosi nessun altro atleta puo' creare una collisione involontaria.
COGNOMI = [
    'ROSSI', 'FERRARI', 'ESPOSITO', 'BIANCHI', 'ROMANO', 'COLOMBO', 'RICCI',
    'MARINO', 'GRECO', 'BRUNO', 'GALLO', 'CONTI', 'DE LUCA', 'COSTA', 'GIORDANO',
    'MANCINI', 'RIZZO', 'LOMBARDI', 'MORETTI', 'BARBIERI', 'FONTANA', 'SANTORO',
    'MARIANI', 'RINALDI', 'CARUSO', 'FERRARA', 'GALLI', 'MARTINI', 'LEONE',
    'LONGO', 'GENTILE', 'MARTINELLI', 'VITALE', 'LOMBARDO', 'SERRA', 'COPPOLA',
    'DE SANTIS', 'D_AMICO', 'MARCHETTI', 'PARISI', 'VILLA', 'CONTE', 'FERRI',
    'FABBRI', 'BIANCO', 'MARINI', 'GRASSO', 'VALENTINI', 'MESSINA', 'SALA',
    'PELLEGRINI', 'PALUMBO', 'SANNA', 'FARINA', 'RIZZI', 'MONTI', 'CATTANEO',
    'MORELLI', 'AMATO', 'SILVESTRI', 'MAZZA', 'TESTA', 'GRANDI', 'PAGANO',
]
NOMI_M = [
    'MARCO', 'ANDREA', 'ALESSANDRO', 'FRANCESCO', 'MATTEO', 'DAVIDE', 'SIMONE',
    'FEDERICO', 'STEFANO', 'GIOVANNI', 'PAOLO', 'ROBERTO', 'MASSIMO', 'FABIO',
    'GIUSEPPE', 'ANTONIO', 'CLAUDIO', 'MAURIZIO', 'ENRICO', 'RICCARDO',
    'LORENZO', 'GABRIELE', 'NICOLA', 'MICHELE', 'DANIELE', 'EMANUELE',
    'CRISTIAN', 'MIRKO', 'IVAN', 'SERGIO', 'WALTER', 'GIORGIO', 'PIETRO',
    'FILIPPO', 'TOMMASO', 'MIRCO', 'DIEGO', 'SAMUELE', 'ALBERTO', 'UMBERTO',
]
NOMI_F = [
    'GIULIA', 'CHIARA', 'FRANCESCA', 'SARA', 'MARTINA', 'ELISA', 'VALENTINA',
    'ALESSIA', 'SILVIA', 'LAURA', 'ELENA', 'ANNA', 'PAOLA', 'MONICA',
    'BARBARA', 'CRISTINA', 'STEFANIA', 'ROBERTA', 'DANIELA', 'ILARIA',
    'BEATRICE', 'CATERINA', 'IRENE', 'ARIANNA', 'MARGHERITA', 'NOEMI',
    'GLORIA', 'DEBORA', 'SABRINA', 'ANTONELLA', 'LOREDANA', 'PATRIZIA',
    'GABRIELLA', 'SIMONETTA', 'ORNELLA', 'CLAUDIA', 'MARIKA', 'GRETA',
    'AURORA', 'VIOLA',
]
OMONIMO = ('VOLPI', 'LUCA')


def coppie(cognomi, nomi):
    """Combinazioni cognome+nome in ordine deterministico, tutte diverse."""
    for n in nomi:
        for c in cognomi:
            yield (c, n)


def anonimizza_iscritti(iscritti):
    # Ordine di lavorazione fisso: senza questo due esecuzioni potrebbero
    # assegnare nomi diversi agli stessi atleti.
    ordinati = sorted(iscritti, key=lambda x: (int(x['pett']), x['cognome'], x['nome']))

    # individua la coppia di omonimi nei dati reali
    conteggio = {}
    for x in ordinati:
        k = (x['cognome'].strip().upper(), x['nome'].strip().upper())
        conteggio.setdefault(k, []).append(x)
    omonimi_reali = {k: v for k, v in conteggio.items() if len(v) > 1}
    if len(omonimi_reali) != 1:
        sys.exit(f'ERRORE: attesa 1 coppia di omonimi nei dati reali, trovate {len(omonimi_reali)}: '
                 f'{list(omonimi_reali)}')
    chiave_omonima = next(iter(omonimi_reali))
    pett_omonimi = sorted(int(x['pett']) for x in omonimi_reali[chiave_omonima])

    # Nessun nome di fantasia deve coincidere con quello di un atleta vero:
    # attribuire il nome di una persona reale ai dati di un'altra sarebbe
    # peggio che non anonimizzare affatto.
    nomi_reali = {(x['cognome'].strip().upper(), x['nome'].strip().upper())
                  for x in ordinati}

    gen_m = coppie(COGNOMI, NOMI_M)
    gen_f = coppie(COGNOMI, NOMI_F)
    usati = set()
    fuori = []

    for idx, x in enumerate(ordinati):
        y = dict(x)
        k = (x['cognome'].strip().upper(), x['nome'].strip().upper())

        if k == chiave_omonima:
            # entrambi i membri della coppia ricevono lo stesso nome finto
            y['cognome'], y['nome'] = OMONIMO
        else:
            gen = gen_f if str(x['sesso']).upper().startswith('F') else gen_m
            while True:
                cand = next(gen)
                if cand not in usati and cand != OMONIMO and cand not in nomi_reali:
                    usati.add(cand)
                    break
            y['cognome'], y['nome'] = cand

        # data di nascita: anno intatto, giorno e mese ricalcolati
        anno = int(str(x['nascita'])[:4])
        mese = (idx % 12) + 1
        giorno = (idx * 7 % 28) + 1          # 1..28: valido in ogni mese
        nuova = f'{anno:04d}-{mese:02d}-{giorno:02d}'
        if nuova == str(x['nascita']):
            # coincidenza fortuita con la data vera: sposto di un giorno
            giorno = (giorno % 28) + 1
            nuova = f'{anno:04d}-{mese:02d}-{giorno:02d}'
        y['nascita'] = nuova
        fuori.append(y)

    return fuori, pett_omonimi


# ---------------------------------------------------------------- verifiche
def verifica(originali, anonimi, pett_omonimi):
    errori = []
    o_per_pett = {int(x['pett']): x for x in originali}

    if len(anonimi) != len(originali):
        errori.append(f'numero di iscritti cambiato: {len(originali)} -> {len(anonimi)}')

    for a in anonimi:
        o = o_per_pett[int(a['pett'])]

        # i campi autentici non devono essere stati toccati
        for campo in ('pett', 'sesso', 'societa', 'conferma', 'catFidal', 'catGara'):
            if str(a[campo]) != str(o[campo]):
                errori.append(f"pett {a['pett']}: campo {campo} alterato "
                              f"({o[campo]!r} -> {a[campo]!r})")

        # l'anno di nascita deve essere conservato
        if str(a['nascita'])[:4] != str(o['nascita'])[:4]:
            errori.append(f"pett {a['pett']}: anno di nascita cambiato "
                          f"({o['nascita']} -> {a['nascita']})")

        # giorno/mese devono invece essere cambiati: altrimenti non e' anonimo
        if str(a['nascita']) == str(o['nascita']):
            errori.append(f"pett {a['pett']}: data di nascita non anonimizzata ({a['nascita']})")

        # e il nome deve essere diverso da quello vero
        if (a['cognome'], a['nome']) == (o['cognome'], o['nome']):
            errori.append(f"pett {a['pett']}: nome non anonimizzato ({a['cognome']} {a['nome']})")

        # la categoria ricalcolata sulla nuova data deve dare lo stesso risultato
        ric = cat_fidal(a['sesso'], int(str(a['nascita'])[:4]), ANNO_RIFERIMENTO)
        if ric != o['catFidal']:
            errori.append(f"pett {a['pett']}: catFidal ricalcolata {ric} != attesa {o['catFidal']}")

    # nessun nome reale deve sopravvivere
    nomi_reali = {(x['cognome'].strip().upper(), x['nome'].strip().upper()) for x in originali}
    nomi_finti = {(x['cognome'].strip().upper(), x['nome'].strip().upper()) for x in anonimi}
    sopravvissuti = nomi_reali & nomi_finti
    if sopravvissuti:
        errori.append(f'nomi reali sopravvissuti all\'anonimizzazione: {sorted(sopravvissuti)}')

    # esattamente una coppia di omonimi, ed e' quella voluta
    c = {}
    for x in anonimi:
        c.setdefault((x['cognome'], x['nome']), []).append(int(x['pett']))
    trovati = {k: sorted(v) for k, v in c.items() if len(v) > 1}
    if list(trovati) != [OMONIMO]:
        errori.append(f'omonimi attesi {{{OMONIMO}}}, trovati {trovati}')
    elif trovati[OMONIMO] != pett_omonimi:
        errori.append(f'la coppia omonima ha pettorali {trovati[OMONIMO]}, '
                      f'attesi {pett_omonimi} (gli stessi dei dati reali)')

    return errori


# ---------------------------------------------------------------- xlsx
INTESTAZIONI = ['Pettorale', 'Cognome', 'Nome', 'Sesso',
                'Soc. per cui gareggia', 'Data di Nascita', 'Conferma']
EPOCA = datetime.date(1899, 12, 30)   # sistema seriale 1900 di Excel


def seriale(iso):
    a, m, g = (int(v) for v in iso.split('-'))
    return (datetime.date(a, m, g) - EPOCA).days


def col(n):
    s = ''
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def scrivi_xlsx(percorso, iscritti):
    """Riproduce la struttura dell'export WISE reale: intestazioni in riga 1,
    testo come stringhe inline, data di nascita come seriale numerico."""
    righe = [
        '<row r="1">' + ''.join(
            f'<c r="{col(i)}1" t="inlineStr"><is><t>{escape(h)}</t></is></c>'
            for i, h in enumerate(INTESTAZIONI)) + '</row>'
    ]
    for n, x in enumerate(iscritti, start=2):
        celle = [
            f'<c r="A{n}" t="n"><v>{int(x["pett"])}</v></c>',
            f'<c r="B{n}" t="inlineStr"><is><t>{escape(x["cognome"])}</t></is></c>',
            f'<c r="C{n}" t="inlineStr"><is><t>{escape(x["nome"])}</t></is></c>',
            f'<c r="D{n}" t="inlineStr"><is><t>{escape(x["sesso"])}</t></is></c>',
            f'<c r="E{n}" t="inlineStr"><is><t>{escape(x["societa"])}</t></is></c>',
            f'<c r="F{n}" s="1" t="n"><v>{seriale(x["nascita"])}</v></c>',
            f'<c r="G{n}" t="inlineStr"><is><t>{escape(x["conferma"])}</t></is></c>',
        ]
        righe.append(f'<row r="{n}">' + ''.join(celle) + '</row>')

    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    foglio = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              f'<worksheet xmlns="{ns}"><sheetData>{"".join(righe)}</sheetData></worksheet>')
    workbook = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<workbook xmlns="{ns}" xmlns:r="{rns}">'
                f'<sheets><sheet name="Iscritti" sheetId="1" r:id="rId1"/></sheets></workbook>')
    wb_rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
               f'<Relationship Id="rId1" Target="worksheets/sheet1.xml" '
               f'Type="{rns}/worksheet"/></Relationships>')
    root_rels = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 f'<Relationship Id="rId1" Target="xl/workbook.xml" '
                 f'Type="{rns}/officeDocument"/></Relationships>')
    # stile 1 = formato data, come nel file WISE originale
    styles = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              f'<styleSheet xmlns="{ns}">'
              f'<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
              f'<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
              f'<borders count="1"><border/></borders>'
              f'<cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs>'
              f'<cellXfs count="2"><xf numFmtId="0" xfId="0"/>'
              f'<xf numFmtId="14" xfId="0" applyNumberFormat="1"/></cellXfs>'
              f'</styleSheet>')
    content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                     '<Default Extension="xml" ContentType="application/xml"/>'
                     '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                     '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                     '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                     '</Types>')

    # date_time fisso: cosi due esecuzioni producono un file identico al byte
    with zipfile.ZipFile(percorso, 'w', zipfile.ZIP_DEFLATED) as z:
        for nome, testo in [
            ('[Content_Types].xml', content_types),
            ('_rels/.rels', root_rels),
            ('xl/workbook.xml', workbook),
            ('xl/_rels/workbook.xml.rels', wb_rels),
            ('xl/styles.xml', styles),
            ('xl/worksheets/sheet1.xml', foglio),
        ]:
            info = zipfile.ZipInfo(nome, date_time=(2025, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, testo)


# ---------------------------------------------------------------- principale
def main():
    src = RADICE / 'reference.json'
    if not src.exists():
        sys.exit(f'ERRORE: {src} non trovato.\n'
                 'I dati reali non sono versionati: devono essere presenti in locale '
                 'per rigenerare i file anonimi.')

    dati = json.loads(src.read_text(encoding='utf-8'))
    iscritti, arrivi = dati['iscritti'], dati['arrivi']
    print(f'letti {len(iscritti)} iscritti e {len(arrivi)} arrivi da reference.json')

    anonimi, pett_omonimi = anonimizza_iscritti(iscritti)
    print(f'coppia di omonimi conservata sui pettorali {pett_omonimi} '
          f'-> {OMONIMO[0]} {OMONIMO[1]}')

    errori = verifica(iscritti, anonimi, pett_omonimi)
    if errori:
        print(f'\nANONIMIZZAZIONE RIFIUTATA: {len(errori)} problemi', file=sys.stderr)
        for e in errori[:25]:
            print('  -', e, file=sys.stderr)
        sys.exit(1)
    print('verifiche superate: categorie, anni di nascita e campi autentici intatti')

    # gli arrivi non vengono toccati: nessun dato personale, solo tempi
    uscita = {
        '_nota': ('Dati di test anonimizzati. Nomi e giorno/mese di nascita sono '
                  'di fantasia; pettorali, sesso, societa, anno di nascita, tempi, '
                  'categorie e posizioni sono quelli reali della 7a Stradolcetto. '
                  'Rigenerabile con: python tools/anonimizza.py'),
        '_annoRiferimento': ANNO_RIFERIMENTO,
        'iscritti': anonimi,
        'arrivi': arrivi,
    }
    dst = RADICE / 'reference_anon.json'
    # newline='\n' esplicito: su Windows write_text traduce ogni \n in \r\n,
    # e questo file finirebbe nel repository con i fine-riga sbagliati come
    # e' gia' successo a index.html. I fine-riga qui sono LF, sempre; vedi
    # .gitattributes e tools/testo.js.
    with open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(uscita, ensure_ascii=False, indent=1))
    print(f'scritto {dst.name}')

    dst_x = RADICE / 'wise_iscritti_anon.xlsx'
    scrivi_xlsx(dst_x, sorted(anonimi, key=lambda x: int(x['pett'])))
    print(f'scritto {dst_x.name} ({dst_x.stat().st_size} byte, '
          f'{len(anonimi)} righe + intestazioni)')


if __name__ == '__main__':
    main()
