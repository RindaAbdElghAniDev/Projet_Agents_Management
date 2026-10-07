// Transforme une valeur en un champ CSV sûr (gère guillemets, virgules, retours à la ligne)
const escapeField = (value) => {
  let str = value === null || value === undefined ? '' : String(value);
  // NEW-01 (CWE-1236) : neutralise la CSV/Formula Injection — toute valeur
  // commençant par un marqueur de formule de tableur (=, +, -, @, tab, CR)
  // est préfixée d'une apostrophe (marqueur "cellule texte" Excel/Calc).
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// rows: tableau d'objets à exporter. columns: [{ key, label }]
const toCSV = (rows, columns) => {
  const header = columns.map((c) => escapeField(c.label)).join(';');
  const lines = rows.map((row) => columns.map((c) => escapeField(row[c.key])).join(';'));
  // Le BOM ("\uFEFF") indique à Excel que le fichier est en UTF-8, sinon les accents s'affichent mal
  return '\uFEFF' + [header, ...lines].join('\r\n');
};

module.exports = { toCSV };