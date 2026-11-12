// Which fee-list engineer is the signed-in Microsoft account. The roster's email_prefix is the
// identity the backend already uses ({email_prefix}@firedynamicsgroup.com on the letter, and the
// roster lookup in routers/auth.py), so the account username is matched to it first; otherwise the
// account display name must equal a roster full name. No match, or more than one, means nobody.

import type { Engineer } from './fee-types';

export const FD_EMAIL_DOMAIN = 'firedynamicsgroup.com';

export interface FdAccount {
  /** MSAL homeAccountId: changes when a different person signs in. */
  key: string;
  username: string;
  name: string | null;
}

const normalise = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function engineerForAccount(account: FdAccount | null, engineers: readonly Engineer[]): string | null {
  if (!account) return null;
  const username = account.username.trim().toLowerCase();
  const suffix = `@${FD_EMAIL_DOMAIN}`;
  if (username.endsWith(suffix)) {
    const prefix = username.slice(0, -suffix.length);
    const byPrefix = engineers.filter((engineer) => engineer.email_prefix.trim().toLowerCase() === prefix);
    if (byPrefix.length === 1) return byPrefix[0].full_name;
    if (byPrefix.length > 1) return null;
  }
  if (!account.name?.trim()) return null;
  const name = normalise(account.name);
  const byName = engineers.filter((engineer) => normalise(engineer.full_name) === name);
  return byName.length === 1 ? byName[0].full_name : null;
}
