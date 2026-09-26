// Transforme une valeur en un champ CSV sûr (gère guillemets, virgules, retours à la ligne)
const escapeField = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
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