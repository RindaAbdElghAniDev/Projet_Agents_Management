#!/usr/bin/env node
'use strict';

/* ============================================================================
 * SEC-15 Phase 1 — Migration Runner (CLI manuelle, mysql2, 0 dépendance)
 * ----------------------------------------------------------------------------
 * RÈGLES :
 *   - CLI manuelle UNIQUEMENT : jamais importé par server.js, aucune
 *     migration automatique au démarrage du serveur.
 *   - Réutilise le pool MySQL existant (config/db.js) : AUCUNE seconde
 *     connexion, AUCUN credential dupliqué ni affiché (.env, DB_PASSWORD,
 *     JWT_SECRET ne sont jamais lus/affichés ici).
 *   - Phase 1 : seule commande autorisée = --status (lecture seule).
 *     Toute écriture DB est bloquée par WRITES_ENABLED = false.
 *     Les commandes --baseline-mark et --up sont PRÉPARÉES mais inactives.
 *
 * COMMANDES :
 *   node migrations/run.js --status                (lecture seule, Phase 1)
 *   node migrations/run.js --baseline-mark         (préparé — Phase 2)
 *   node migrations/run.js --up <migration-file>   (préparé — Phase 2)
 *   --allow-destructive : requis si la migration contient DROP TABLE,
 *                         DROP COLUMN, TRUNCATE ou DELETE FROM.
 *
 * EXIT CODES : 0 = succès · 1 = erreur · 2 = écriture bloquée (Phase 1)
 * ==========================================================================*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Charge le .env du backend PEU IMPORTE le répertoire de lancement (cwd),
// puis réutilise le pool existant : aucun credential dupliqué ni affiché.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db'); // pool existant — credentials via .env, jamais dupliqués

// --- Constantes -------------------------------------------------------------
const MIGRATIONS_DIR = __dirname;
const TRACKING_TABLE = 'schema_migrations';
const BASELINE_FILE = '000_baseline.sql';
const BASELINE_VERSION = '000';
const BASELINE_NAME = 'baseline';

// PHASE 1 : écritures DB interdites. La Phase 2 basculera cette valeur à true
// uniquement après validation de l'adoption (--baseline-mark).
const WRITES_ENABLED = false;

// DDL de suivi — PRÉPARÉ pour la Phase 2. JAMAIS exécuté pendant la Phase 1.
const CREATE_TRACKING_TABLE_SQL = [
  'CREATE TABLE schema_migrations (',
  '  version VARCHAR(100) NOT NULL PRIMARY KEY,',
  '  name VARCHAR(255) NOT NULL,',
  '  checksum CHAR(64) NOT NULL,',
  '  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
].join('\n');

// Format des futures migrations : NNN_description_up.sql (ex : 001_drop_reset_code_up.sql)
const MIGRATION_FILE_RE = /^(\d{3})_([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)_up\.sql$/;
// Cas particulier du baseline (adoption, jamais exécuté via --up)
const BASELINE_FILE_RE = /^000_baseline\.sql$/;

// Protection anti-destructif : ces opérations exigent --allow-destructive
const DESTRUCTIVE_RE = /\b(?:DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i;

// Les 7 tables du baseline — vérification d'adoption prévue en Phase 2
const BASELINE_TABLES = [
  'users', 'departments', 'agents', 'attendance',
  'leaves', 'activity_logs', 'password_reset_tokens',
];

// --- Utilitaires ------------------------------------------------------------
function usage() {
  console.log([
    'Usage : node migrations/run.js <commande> [options]',
    '',
    'Commandes :',
    '  --status                 Affiche l état (LECTURE SEULE, aucune écriture).',
    '  --baseline-mark          Marque 000_baseline comme appliqué SANS exécuter',
    '                           son SQL. (préparé — bloqué en Phase 1)',
    '  --up <migration-file>    Exécute explicitement UNE migration nommée.',
    '                           (préparé — bloqué en Phase 1)',
    '',
    'Options :',
    '  --allow-destructive      Autorise DROP TABLE / DROP COLUMN / TRUNCATE /',
    '                           DELETE FROM dans une migration --up.',
    '  --help, -h               Affiche cette aide.',
    '',
    'Format des migrations : NNN_description_up.sql (ex : 001_add_x_up.sql)',
    'Aucune exécution automatique : jamais au démarrage du serveur.',
  ].join('\n'));
}

function fail(message, code) {
  const err = new Error(message);
  err.exitCode = code || 1;
  throw err;
}

// Bloque TOUTE écriture DB tant que la Phase 1 est active (exit code 2).
function assertWritesAllowed(command) {
  if (!WRITES_ENABLED) {
    fail(
      'ÉCRITURE BLOQUÉE (Phase 1) : la commande « ' + command + ' » n est ' +
      'autorisée qu en Phase 2. Aucune modification de la base n a eu lieu.',
      2
    );
  }
}

// SHA-256 hexadécimal 64 caractères du contenu exact fourni.
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Vérifie l existence de la table de suivi — SELECT information_schema (read-only).
async function trackingTableExists() {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.TABLES ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [TRACKING_TABLE]
  );
  return Number(rows[0].n) > 0;
}

// Lit les migrations déjà appliquées (SELECT uniquement). Appeler seulement
// si trackingTableExists() est vrai.
async function loadApplied() {
  const [rows] = await pool.query(
    'SELECT version, name, checksum, applied_at FROM `' + TRACKING_TABLE + '` ORDER BY version'
  );
  return rows;
}

// Découverte : UNIQUEMENT les fichiers *.sql du dossier migrations/.
// README.md, run.js et tout autre fichier sont ignorés.
// Noms ambigus / mal formés => erreur (arrêt).
function discoverMigrations() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();

  return files.map((file) => {
    let version;
    let name;
    if (BASELINE_FILE_RE.test(file)) {
      version = BASELINE_VERSION;
      name = BASELINE_NAME;
    } else {
      const m = file.match(MIGRATION_FILE_RE);
      if (!m) {
        fail(
          'Fichier de migration au nom ambigu / mal formé : « ' + file + ' ». ' +
          'Format attendu : NNN_description_up.sql (ex : 001_drop_reset_code_up.sql). ' +
          'Renommez-le ou retirez-le de backend/migrations/.'
        );
      }
      version = m[1];
      name = m[2].replace(/_up$/, '');
    }
    const checksum = sha256(fs.readFileSync(path.join(MIGRATIONS_DIR, file)));
    return { file, version, name, checksum };
  });
}

// ============================================================
// --status : 100 % lecture seule (aucune écriture possible)
// ============================================================
async function handleStatus() {
  console.log('== SEC-15 Migration Runner — --status (lecture seule) ==');
  console.log('Répertoire : ' + MIGRATIONS_DIR);

  const exists = await trackingTableExists();
  const local = discoverMigrations(); // peut échouer si nom mal formé

  if (!exists) {
    console.log('');
    console.log(TRACKING_TABLE + ': ABSENTE');
    console.log('  (table de suivi non initialisée — aucune migration appliquée ;');
    console.log('   elle ne sera créée QU en Phase 2 via --baseline-mark)');
    console.log('');
    console.log('Fichiers de migration découverts (' + local.length + ') :');
    for (const m of local) {
      console.log('  - ' + m.file + ' | version ' + m.version + ' | name ' + m.name +
        ' | sha256 ' + m.checksum + ' | état NON ENREGISTRÉ');
    }
    return; // sortie propre — AUCUNE création automatique de table
  }

  const applied = await loadApplied();
  console.log('');
  console.log(TRACKING_TABLE + ': PRÉSENTE (' + applied.length + ' ligne(s))');
  console.log('');
  console.log('Migrations : fichiers locaux=' + local.length + ' · appliquées=' + applied.length);
  const appliedByVersion = new Map(applied.map((a) => [String(a.version), a]));
  for (const m of local) {
    const row = appliedByVersion.get(m.version);
    let etat;
    if (!row) {
      etat = 'PENDING';
    } else if (String(row.checksum) === m.checksum) {
      etat = 'APPLIED';
    } else {
      etat = 'ERREUR: CHECKSUM DIFFÉRENT (fichier modifié après application)';
    }
    console.log('  - ' + m.file + ' | version ' + m.version + ' | sha256 ' + m.checksum +
      ' | ' + etat + (row ? ' | appliquée le ' + row.applied_at : ''));
  }
  const localVersions = new Set(local.map((m) => m.version));
  for (const a of applied) {
    if (!localVersions.has(String(a.version))) {
      console.log('  - version ' + a.version + ' (' + a.name + ') : APPLIQUÉE MAIS FICHIER ABSENT');
    }
  }
}

// ============================================================
// --baseline-mark : PRÉPARÉ (Phase 2) — bloqué en Phase 1
// Comportement FUTUR (désactivé tant que WRITES_ENABLED=false) :
//   1. vérifier que la DB correspond bien au baseline (lecture)
//   2. créer schema_migrations si nécessaire
//   3. inscrire 000_baseline comme appliqué
//   4. NE JAMAIS exécuter le contenu de 000_baseline.sql
// ============================================================
async function handleBaselineMark() {
  assertWritesAllowed('--baseline-mark');

  // Étape 1 : la base correspond-elle au baseline ? (SELECT, read-only)
  const [rows] = await pool.query(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ' +
    '(' + BASELINE_TABLES.map(() => '?').join(',') + ')',
    BASELINE_TABLES
  );
  const found = new Set(rows.map((r) => r.t));
  const missing = BASELINE_TABLES.filter((t) => !found.has(t));
  if (missing.length) {
    fail('La base ne correspond pas au baseline — tables manquantes : ' + missing.join(', '));
  }

  // Étape 2 : créer la table de suivi SI nécessaire (seule écriture DDL autorisée
  // par cette commande, et uniquement en Phase 2).
  if (!(await trackingTableExists())) {
    await pool.query(CREATE_TRACKING_TABLE_SQL);
  }

  // Étape 3 : inscrire 000_baseline — sans jamais exécuter son SQL.
  const checksum = sha256(fs.readFileSync(path.join(MIGRATIONS_DIR, BASELINE_FILE)));
  const [dup] = await pool.query(
    'SELECT checksum FROM `' + TRACKING_TABLE + '` WHERE version = ?',
    [BASELINE_VERSION]
  );
  if (dup.length) {
    if (String(dup[0].checksum) !== checksum) {
      fail('Checksum du baseline déjà enregistré et DIFFÉRENT du fichier actuel — refus (aucun écrasement automatique).');
    }
    console.log('000_baseline déjà marqué (checksum inchangé) — rien à faire.');
    return;
  }
  await pool.query(
    'INSERT INTO `' + TRACKING_TABLE + '` (version, name, checksum) VALUES (?, ?, ?)',
    [BASELINE_VERSION, BASELINE_NAME, checksum]
  );
  console.log('000_baseline marqué comme appliqué (contenu SQL du baseline NON exécuté).');
}

// ============================================================
// Protections & exécution (préparés — Phase 2)
// ============================================================
function containsDestructive(sql) {
  return DESTRUCTIVE_RE.test(sql);
}

// Sépare un fichier SQL en instructions individuelles en ignorant les
// guillemets (' " `), les échappements, les commentaires -- et /* */.
// (Permet d'exécuter un fichier multi-statements sans activer
//  multipleStatements sur le pool partagé du projet.)
function splitStatements(sql) {
  const out = [];
  let cur = '';
  let quote = null;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote !== '`') { // échappement SQL (\' \")
        if (i + 1 < sql.length) cur += sql[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        if (next === quote) { cur += next; i += 2; continue; } // '' "" doublé
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; i += 1; continue; }
    if (ch === '-' && next === '-') { while (i < sql.length && sql[i] !== '\n') i += 1; continue; }
    if (ch === '/' && next === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1; i += 2; continue; }
    if (ch === ';') { const s = cur.trim(); if (s) out.push(s); cur = ''; i += 1; continue; }
    cur += ch;
    i += 1;
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

// ============================================================
// --up <file> : PRÉPARÉ (Phase 2) — bloqué en Phase 1
// Comportement FUTUR (désactivé tant que WRITES_ENABLED=false) :
//   1. vérifier que le fichier existe (dans migrations/)
//   2. calculer son checksum SHA-256
//   3. vérifier s il est déjà enregistré
//   4. refuser si enregistré avec un checksum différent
//   5. refuser une version déjà appliquée (autre fichier)
//   6. exécuter EXPLICITEMENT la migration demandée
//   7. l enregistrer dans schema_migrations
// ============================================================
async function handleUp(fileArg, allowDestructive) {
  assertWritesAllowed('--up');

  if (!fileArg) {
    fail('Usage : node migrations/run.js --up <migration-file> (ex : 001_add_column_up.sql)');
  }
  // 1. Le fichier doit être un nom simple situé dans migrations/
  const file = path.basename(fileArg);
  if (file !== fileArg || /[\\/]/.test(fileArg)) {
    fail('Le fichier doit être un simple nom situé dans backend/migrations/ : « ' + fileArg + ' »');
  }
  if (file === BASELINE_FILE) {
    fail('000_baseline.sql ne doit JAMAIS être exécuté via --up (adoption via --baseline-mark uniquement).');
  }
  const full = path.join(MIGRATIONS_DIR, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    fail('Fichier de migration introuvable : « ' + file + ' »');
  }
  const m = file.match(MIGRATION_FILE_RE);
  if (!m) {
    fail('Nom mal formé : « ' + file + ' ». Format attendu : NNN_description_up.sql');
  }
  const version = m[1];
  const name = m[2].replace(/_up$/, '');

  // 2. Checksum du contenu exact
  const buf = fs.readFileSync(full);
  const checksum = sha256(buf);
  const sql = buf.toString('utf8');

  // Doublon de version dans le dossier (autre fichier même NNN) ?
  const dupLocal = discoverMigrations().find((x) => x.version === version && x.file !== file);
  if (dupLocal) {
    fail('Version ' + version + ' déjà portée par un autre fichier : « ' + dupLocal.file + ' » (refus).');
  }

  // La table de suivi doit exister (créée par --baseline-mark en Phase 2)
  if (!(await trackingTableExists())) {
    fail(TRACKING_TABLE + ' absente : initialisation requise via --baseline-mark (Phase 2).');
  }

  // 3-4. Déjà enregistré ?
  const [applied] = await pool.query(
    'SELECT version, checksum FROM `' + TRACKING_TABLE + '` WHERE version = ?',
    [version]
  );
  if (applied.length) {
    if (String(applied[0].checksum) === checksum) {
      console.log('Version ' + version + ' déjà appliquée (checksum identique) — rien à faire.');
      return;
    }
    fail('Version ' + version + ' déjà enregistrée avec un checksum DIFFÉRENT — refus (jamais d écrasement automatique).');
  }

  // 5. Protection anti-destructif
  if (containsDestructive(sql) && !allowDestructive) {
    fail(
      'La migration « ' + file + ' » contient une opération DÉTRUCTIVE ' +
      '(DROP TABLE / DROP COLUMN / TRUNCATE / DELETE FROM). ' +
      'Si c est intentionnel, relancer avec --allow-destructive.'
    );
  }

  // 6. Exécution explicite de la migration demandée uniquement
  const statements = splitStatements(sql);
  if (!statements.length) {
    fail('Fichier de migration vide : « ' + file + ' »');
  }
  for (const stmt of statements) {
    await pool.query(stmt); // DDL MySQL non transactionnel : en cas d échec au
    // milieu, arrêt immédiat + restauration depuis le backup (voir rollback).
  }

  // 7. Enregistrement
  await pool.query(
    'INSERT INTO `' + TRACKING_TABLE + '` (version, name, checksum) VALUES (?, ?, ?)',
    [version, name, checksum]
  );
  console.log('Appliqué : ' + file + ' (version ' + version + ', ' + statements.length + ' instruction(s), sha256 ' + checksum + ').');
}

// ============================================================
// Point d'entrée CLI — AUCUNE exécution automatique au démarrage
// (ce fichier n est jamais importé par server.js)
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (!args.length) {
    usage();
    fail('Commande manquante.');
  }
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  const allowDestructive = args.includes('--allow-destructive');

  if (args.includes('--status')) {
    await handleStatus();
    return;
  }
  if (args.includes('--baseline-mark')) {
    await handleBaselineMark();
    return;
  }
  const upIdx = args.indexOf('--up');
  if (upIdx !== -1) {
    await handleUp(args[upIdx + 1], allowDestructive);
    return;
  }

  usage();
  fail('Commande inconnue : « ' + args.join(' ') + ' »');
}

main()
  .then(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch((err) => {
    // Erreur claire, SANS stack trace inutile, SANS .env / password / JWT /
    // donnée utilisateur (seul le message d exception est affiché).
    const code = err && Number.isInteger(err.exitCode) ? err.exitCode : 1;
    console.error('ERREUR : ' + (err && err.message ? err.message : String(err)));
    process.exit(code);
  });
