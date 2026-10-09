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
  '50aeda2d707b10d8': 'Transportation Director 2'
};

// Email LOCAL PARTS the same way: a few staff mailboxes appear in source pages (a change-notice list, say).
// The domain is scrubbed by build-demo.mjs; the local part is matched here by hash and swapped for a role mailbox.
export const EMAIL_LOCAL_ALIASES = {
  '12daafc5496c40f9': 'facilities',
  '8ec71017742872f6': 'it',
  '85ade4b71517707c': 'admin'
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

/** True if any aliased name still appears (for scanners). */
export function findStaffNames(text) {
  return [...text.matchAll(/\b[A-Z][a-z]+\b/g)].map((m) => m[0]).filter((w) => STAFF_ALIASES[h(w)]);
}
