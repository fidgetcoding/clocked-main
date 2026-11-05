# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | Yes |

## Reporting a Vulnerability

If you find a security problem in Clocked, please report it privately:

1. **Don't open a public GitHub issue.**
2. Use GitHub's private reporting: the repo's **Security** tab → **Report a vulnerability**, or go straight to <https://github.com/fidgetcoding/clocked-main/security/advisories/new>. Only the maintainer sees the report.
3. Include what you found, how to reproduce it, and what it could affect.
4. You'll hear back within 48 hours.

## What's worth reporting

Anything that lets someone read or change another person's account or club data, or get the server to credit XP it shouldn't. The database rules and functions in `supabase/` count too.
