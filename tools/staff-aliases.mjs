// staff-aliases.mjs — replace real staff first names with role aliases, matched by HASH.
//
// Source comments name the people a tool was built for ("in X's own words", "X's master list").
// This repo is PUBLIC, so those names must not ship — but a scrub list that spells them out would
// publish them itself. So each name is stored only as the first 16 hex chars of
// sha256(lowercased name), the same scheme demos/transpo-routes/verify.mjs uses to detect real
// names. Only Capitalised words are considered, so the unit "miles" is never touched.
//
// To add someone: node -e "console.log(require('crypto').createHash('sha256')
//   .update('firstname').digest('hex').slice(0,16))"
import { createHash } from 'node:crypto';

export const STAFF_ALIASES = {
  '2fa9eb130ea98eb6': 'Transportation Director 1',
  '50aeda2d707b10d8': 'Transportation Director 2',
  '0bcf62b62f026b79': 'the Approver',
  '29c935ee7ec55b55': 'the Office Manager',
  '7904841598a49a87': 'Purchasing'
};

// Email LOCAL PARTS the same way: a few staff mailboxes appear in source pages (a change-notice list, say).
// The domain is scrubbed by build-demo.mjs; the local part is matched here by hash and swapped for a role mailbox.
export const EMAIL_LOCAL_ALIASES = {
  '12daafc5496c40f9': 'facilities',
  '8ec71017742872f6': 'it',
  '85ade4b71517707c': 'admin',
  '18913dffa034e973': 'backup.approver'
};
const LOCAL = /\b([a-z][a-z0-9._-]{1,30})@/g;

/** Returns { text, count }: real staff mailboxes become role mailboxes (facilities@, it@ ...). */
export function aliasEmailLocals(text) {
  let count = 0;
  const out = text.replace(LOCAL, (m, local) => {
    const alias = EMAIL_LOCAL_ALIASES[h(local)];
    if (!alias) return m;
    count++;
    return alias + '@';
  });
  return { text: out, count };
}

// A capitalised word NOT followed by another capitalised word — so a full name that merely shares
// a first name (an author in the library catalogue, say) is left alone. Fabricated children in
// data.js are never passed through here; only built pages and vendored logic are.
const WORD = /\b([A-Z][a-z]+)\b(?!\s+[A-Z][a-z])/g;
const h = (w) => createHash('sha256').update(w.toLowerCase()).digest('hex').slice(0, 16);

/** Returns { text, count }. */
export function aliasStaffNames(text) {
  let count = 0;
  const out = text.replace(WORD, (m) => {
    const alias = STAFF_ALIASES[h(m)];
    if (!alias) return m;
    count++;
    return alias;
  });
  return { text: out, count };
}

/** Shared phrase aliases, applied by every build (build-demo and each build-logic): people whose
 *  replacement reads the same in every app — full names a first-name alias cannot catch (a first name
 *  followed by a surname is deliberately skipped by aliasStaffNames), and a few family names. */
export const PHRASE_ALIASES = {
  '49a725bccb71d604': 'the office manager',
  '76a981126144db8b': 'Sowell Gina',
  '25adea4cb817ea12': 'Gina Sowell',
  'cbf8b8d229fa7fac': 'an older sibling',
  '1318b84a35151999': 'Halvorsens',
  '38797be92acdf726': 'Halvorsen',
  '4a77d58e0b501a64': 'Sowell',
  '79a6a933dfc9b197': 'Gina'
};

/** Per-build phrase aliases: { sha256(lowercased phrase).slice(0,16): replacement }. A phrase is one to
 *  three letter-words joined by single spaces, matched case-insensitively, longest first — so a surname
 *  shared by a family ("the X boys") and a staff full name ("X Y") can map differently, and the config
 *  that carries the table never spells the names. A hyphen joins too, for a double first name ("X-Y Z"):
 *  the key keeps the real separator, so a space-joined key never matches across a hyphen and every
 *  space-joined key behaves exactly as before. Returns { text, count }. */
export function aliasPhrases(text, table) {
  if (!table || !Object.keys(table).length) return { text, count: 0 };
  const words = [...text.matchAll(WORDS)];
  let out = '', last = 0, count = 0;
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = 3; n >= 1 && !hit; n--) {
      if (i + n > words.length) continue;
      let key = words[i][0], joined = true;
      for (let k = i; k < i + n - 1; k++) {
        const sep = text.slice(words[k].index + words[k][0].length, words[k + 1].index);
        if (sep !== ' ' && sep !== '-') { joined = false; break; }
        key += sep + words[k + 1][0];
      }
      if (!joined) continue;
      const alias = table[h(key)];
      if (alias !== undefined) hit = { n, alias };
    }
    if (!hit) { i++; continue; }
    const end = words[i + hit.n - 1];
    out += text.slice(last, words[i].index) + hit.alias;
    last = end.index + end[0].length;
    count++;
    i += hit.n;
  }
  return { text: out + text.slice(last), count };
}

/** Every phrase from `table` still present in text (for verifiers and the scanner). */
export function findPhrases(text, table, capitalOnly) {
  if (!table) return [];
  const ms = [...text.matchAll(WORDS)], words = ms.map((m) => m[0]);
  const found = [];
  for (let i = 0; i < words.length; i++) {
    if (capitalOnly && !/^[A-Z]/.test(words[i])) continue;
    let real = words[i];   // the same words joined by their real separators while those are ' ' or '-' (see aliasPhrases)
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      if (n > 1 && real !== null) {
        const sep = text.slice(ms[i + n - 2].index + words[i + n - 2].length, ms[i + n - 1].index);
        real = sep === ' ' || sep === '-' ? real + sep + words[i + n - 1] : null;
      }
      if (table[h(words.slice(i, i + n).join(' '))] !== undefined || (real !== null && table[h(real)] !== undefined)) found.push(i);
    }
  }
  return found;
}
const WORDS = /(?<![A-Za-z0-9])[A-Za-z]+(?![A-Za-z0-9])/g;

/** Staff first names INSIDE an identifier: a camelCase, snake_case or kebab-case part (canXEdit, xUpdateOrder,
 *  submitToX, x-note). Source code names server methods and element ids after the person who uses them, and
 *  aliasStaffNames (whole capitalised words only) cannot see those. Opt-in per build (cfg.aliasIdentifiers): a part
 *  can be an ordinary word that is also someone's name (a ...Miles distance), and a renamed server method means the
 *  demo's hand-written mock and verifier must use the new name. The alias becomes an identifier part, in the case of
 *  the part it replaces: 'the Approver' -> approver / Approver. Returns { text, count }. */
export function aliasIdentifierParts(text) {
  let count = 0;
  const out = text.replace(IDENT, (id) => {
    if (!isCompound(id)) return id;
    return id.replace(PART, (part) => {
      const alias = STAFF_ALIASES[h(part)];
      if (!alias) return part;
      count++;
      return identForm(alias, /^[A-Z]/.test(part));
    });
  });
  return { text: out, count };
}
/** Identifiers that carry a staff first name as a part, minus ones known not to name anyone (for scanners). */
export function findIdentifierNames(text) {
  return (text.match(IDENT) || []).filter((id) => isCompound(id) && !IDENT_NOT_NAMES.has(id) &&
    (id.match(PART) || []).some((p) => STAFF_ALIASES[h(p)]));
}
export const IDENT_NOT_NAMES = new Set(['distanceMiles']);   // a unit, not a person
const IDENT = /[A-Za-z_$][\w$]*(?:-[A-Za-z][\w$]*)*/g;
const PART = /[A-Z]?[a-z]+/g;
const isCompound = (id) => /[_-]/.test(id) || /[a-z0-9][A-Z]/.test(id);
function identForm(alias, upper) {
  const w = alias.replace(/^the\s+/i, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const s = w.map((x, i) => (i ? x[0].toUpperCase() + x.slice(1).toLowerCase() : x.toLowerCase())).join('');
  return upper ? s[0].toUpperCase() + s.slice(1) : s;
}

/** True if any aliased name still appears (for scanners). */
export function findStaffNames(text) {
  return [...text.matchAll(/\b[A-Z][a-z]+\b/g)].map((m) => m[0]).filter((w) => STAFF_ALIASES[h(w)]);
}
