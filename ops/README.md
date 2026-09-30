# ops/

Everything that runs or ships the site, versioned with the code. Nothing here runs by itself; each file says how to use it.

| Path | What it is |
|---|---|
| `build.sh` | Builds one release on a clean Linux machine (CI): API with production `node_modules`, storefront standalone bundle, one tarball |
| `deploy.sh` | Upload, pre-migration database dump, migrations through an SSH tunnel, switch, health check, automatic rollback |
| `rollback.sh` | Puts the previous release back |
| `server/activate.sh` | Runs on the server: atomic `current` symlink swap, restart, health gate, prune to the last 5 releases |
| `server/fuzzball-dump`, `server/sudoers-fuzzball-deploy` | The only two things the `deploy` user may do as root |
| `install.sh` | One-time server setup (users, directories, systemd, nginx, TLS, firewall, fail2ban, updates) |
| `nginx/` | The site (TLS, one origin, `/api` prefix, rate limits), request-limit zones, shared security headers |
| `systemd/` | `fuzzball-api` and `fuzzball-web` units: memory caps, sandboxing, graceful stop |
| `postgres/` | Database and role setup, server settings, `pg_hba` rules |
| `backup/` | Nightly encrypted offsite backup, monthly restore drill |
| `env/` | Templates for `/etc/fuzzball/api.env` and `web.env` |

Start with `docs/DEPLOY_PROD.md`. Incidents: `docs/RUNBOOK_OPS.md` (day to day) and `docs/RUNBOOK_DR.md` (restores).

Server layout (`/var/www/fuzzball`):

```
releases/<git sha>/{api,web,activate.sh,RELEASE.env}   one directory per deploy, built on CI, read-only
current  -> releases/<sha>                              what is running
previous -> releases/<sha>                              what ran before (rollback target)
shared/uploads, shared/next-cache                       survive every release
```

The scripts can be checked without a server: `bash -n` on each, `ops/build.sh <id>` in a scratch checkout.
