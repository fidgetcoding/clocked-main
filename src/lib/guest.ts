import { toast } from 'sonner';

// user_id stamped on browser-only rows. Guests never write these to the database.
export const GUEST_USER_ID = 'guest';

/** Offers the email link in place of an error when a guest tries something that needs an account. */
export function promptEmailLink(action: string) {
  toast(`Sign in with an email link to ${action}.`, {
    action: {
      label: 'Email me a link',
      onClick: () => window.location.assign('/auth'),
    },
  });
}
