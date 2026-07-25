/**
 * Collaborator directory. Each entry maps a name → a website/social URL; a
 * non-empty URL makes that name a clickable link wherever it appears in project
 * credits (blank = plain text). Names must match the credits in projects.json
 * exactly (some people are credited under slightly different spellings — point
 * each variant at the same URL).
 *
 * The data lives in `src/data/people.json` so the dev-only authoring form at
 * `/admin` can edit it; this module just re-exports it plus the credit parser.
 */
import directory from '../data/people.json';

export const OWNER = directory.owner;
export const PEOPLE = directory.people;

/**
 * Parse a credit string ("Role — Name1, Name2") into a role and a list of
 * people with resolved links + self-flag.
 */
export function parseCredit(credit) {
  const m = credit.match(/^(.*?)\s[—–-]\s(.*)$/);
  const role = m ? m[1].trim() : '';
  const rest = m ? m[2] : credit;

  const names = rest
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      url: PEOPLE[name] || '',
      self: name === OWNER,
    }));

  return { role, names };
}
