'use strict';
/*
 * Scrivere un file di testo con i fine-riga giusti, che qui vuol dire LF.
 *
 * PERCHÉ ESISTE. L'impronta che finisce in sw.js è il SHA-256 dei byte dei
 * file del guscio, e un CRLF al posto di un LF cambia i byte.
 *
 * .gitattributes mette a posto quello che viene REGISTRATO. Questo mette a
 * posto quello che finisce SUL DISCO, e senza questa metà l'altra farebbe
 * danno invece di bene: git normalizzerebbe il file registrato lasciando
 * sul disco quello che c'è, e siccome l'impronta si calcola sul file locale
 * il numero di qui e quello di un clone appena scaricato divergerebbero.
 *
 * Che i fine-riga cambino da soli non è un'ipotesi: index.html è passato da
 * LF a CRLF senza che nessuno lo decidesse, 4461 byte in più che in un diff
 * non si vedono.
 */

const fs = require('fs');

/** Il testo con i fine-riga di Unix, qualunque cosa avesse prima. */
const aLf = testo => String(testo).replace(/\r\n/g, '\n');

/** Scrive un file di testo in UTF-8 con i fine-riga LF. */
function scriviTesto(percorso, testo) {
  fs.writeFileSync(percorso, aLf(testo), 'utf8');
}

module.exports = { aLf, scriviTesto };
