#!/usr/bin/env bash
# One-time server setup for FuzzBall Factory on Ubuntu 22.04/24.04. Run ON the server, as root, from a checkout of this
# repo (or a copy of the ops/ folder). Safe to run again: every step checks before it changes anything.
#
#   sudo ops/install.sh --yes --domain shop.example.com --email you@example.com [--deploy-key /path/to/key.pub]
#
# What it changes (read before running; it touches the firewall and nginx):
#   - apt: nginx, ufw, fail2ban, unattended-upgrades, certbot, age, rclone
#   - users: `fuzzball` (runs the apps, no shell) and `deploy` (CI deploys, no sudo except two commands)
#   - /var/www/fuzzball/{releases,shared}, /etc/fuzzball (env files, root:fuzzball 0750)
#   - systemd units fuzzball-api and fuzzball-web (enabled, not started: there is no release yet)
#   - nginx site for the domain + a Let's Encrypt certificate + renewal hook
#   - ufw: deny incoming except SSH (the port sshd really listens on), 80 and 443
#   - fail2ban sshd jail; unattended security upgrades (no automatic reboot)
#   - /usr/local/sbin/fuzzball-dump and a sudoers file for the deploy user
# It does NOT install Node or Postgres, create the database (ops/postgres/setup.sql) or fill in secrets.
set -euo pipefail

yes=0; domain=""; email=""; deploy_key=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) yes=1 ;;
    --domain) domain="${2:?}"; shift ;;
    --email) email="${2:?}"; shift ;;
    --deploy-key) deploy_key="${2:?}"; shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
[ "$yes" -eq 1 ] || { sed -n '2,20p' "$0"; echo; echo "Re-run with --yes to go ahead." >&2; exit 1; }
[[ "$domain" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "--domain must be a hostname like shop.example.com" >&2; exit 2; }

here="$(cd "$(dirname "$0")" && pwd)"
log() { printf '\n== %s ==\n' "$*"; }

log "Node"
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$node_major" -ge 22 ] || { echo "Node 22 or newer is required at /usr/bin/node (found: ${node_major}). Install it first (NodeSource or nvm-free system package), then re-run." >&2; exit 1; }
[ "$(command -v node)" = "/usr/bin/node" ] || echo "WARNING: node is at $(command -v node), the units use /usr/bin/node: symlink it or edit the units." >&2

log "Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx ufw fail2ban unattended-upgrades certbot age rclone curl

log "Users and directories"
id fuzzball >/dev/null 2>&1 || useradd --system --home-dir /var/www/fuzzball --shell /usr/sbin/nologin fuzzball
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
  usermod -aG systemd-journal deploy
  passwd -l deploy >/dev/null
fi
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
if [ -n "$deploy_key" ]; then
  # Restrict the CI key: no agent/X11 forwarding, no tty; port forwarding only to Postgres (migrations ride on it).
  line="restrict,port-forwarding,permitopen=\"127.0.0.1:5432\" $(cat "$deploy_key")"
  grep -qF "$(cat "$deploy_key")" /home/deploy/.ssh/authorized_keys || echo "$line" >> /home/deploy/.ssh/authorized_keys
fi
install -d -m 0755 -o deploy -g deploy /var/www/fuzzball /var/www/fuzzball/releases
install -d -m 0755 -o fuzzball -g fuzzball /var/www/fuzzball/shared /var/www/fuzzball/shared/uploads /var/www/fuzzball/shared/next-cache
install -d -m 0750 -o root -g fuzzball /etc/fuzzball
install -d -m 0755 /var/www/certbot
for f in api web; do
  [ -f "/etc/fuzzball/$f.env" ] || { sed "s/__DOMAIN__/$domain/g" "$here/env/$f.env.example" > "/etc/fuzzball/$f.env"; chown root:fuzzball "/etc/fuzzball/$f.env"; chmod 0640 "/etc/fuzzball/$f.env"; echo "created /etc/fuzzball/$f.env: fill in every __PLACEHOLDER__ before the first deploy"; }
done

log "systemd"
install -m 0644 "$here/systemd/fuzzball-api.service" "$here/systemd/fuzzball-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable fuzzball-api fuzzball-web

log "Deploy user permissions and dump script"
install -m 0755 "$here/server/fuzzball-dump" /usr/local/sbin/fuzzball-dump
install -m 0440 "$here/server/sudoers-fuzzball-deploy" /etc/sudoers.d/fuzzball-deploy
visudo -cf /etc/sudoers.d/fuzzball-deploy >/dev/null || { rm -f /etc/sudoers.d/fuzzball-deploy; echo "sudoers file invalid, removed" >&2; exit 1; }

log "nginx and certificate"
install -m 0644 "$here/nginx/fuzzball-zones.conf" /etc/nginx/conf.d/fuzzball-zones.conf
install -d /etc/nginx/snippets
install -m 0644 "$here/nginx/fuzzball-headers.conf" /etc/nginx/snippets/fuzzball-headers.conf
rm -f /etc/nginx/sites-enabled/default
if [ ! -d "/etc/letsencrypt/live/$domain" ]; then
  [ -n "$email" ] || { echo "--email is required to get the first certificate" >&2; exit 2; }
  # HTTP-only bootstrap so certbot can answer its challenge; the real site replaces it right after.
  cat > /etc/nginx/sites-available/fuzzball <<BOOT
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
BOOT
  ln -sfn /etc/nginx/sites-available/fuzzball /etc/nginx/sites-enabled/fuzzball
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot -d "$domain" --email "$email" --agree-tos --no-eff-email --non-interactive
fi
sed "s/__DOMAIN__/$domain/g" "$here/nginx/fuzzball.conf" > /etc/nginx/sites-available/fuzzball
ln -sfn /etc/nginx/sites-available/fuzzball /etc/nginx/sites-enabled/fuzzball
nginx -t
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
systemctl reload nginx

log "Firewall"
ssh_port="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
ssh_port="${ssh_port:-22}"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "$ssh_port"/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status verbose | head -12

log "fail2ban and automatic security updates"
cat > /etc/fail2ban/jail.d/fuzzball.local <<JAIL
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban
cat > /etc/apt/apt.conf.d/52fuzzball-unattended <<'APT'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
APT
systemctl enable --now unattended-upgrades >/dev/null

log "Done"
cat <<NEXT
Next:
  1. Postgres:     psql as postgres, run ops/postgres/setup.sql (see its header), apply ops/postgres/fuzzball.conf
  2. Secrets:      edit /etc/fuzzball/api.env (every __PLACEHOLDER__), then chmod stays 0640 root:fuzzball
  3. CI access:    add the deploy public key (re-run with --deploy-key), set the GitHub environment secrets (docs/DEPLOY_PROD.md)
  4. First deploy: run the "Deploy" workflow; the first release also needs the seed (docs/DEPLOY_PROD.md)
  5. Backups:      ops/backup/install-backup.sh
NEXT
