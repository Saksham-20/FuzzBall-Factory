#!/usr/bin/env bash
# Installs the nightly backup timer. Run as root after creating /etc/fuzzball/backup.env (see backup.sh for its keys).
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
[ -f /etc/fuzzball/backup.env ] || { echo "create /etc/fuzzball/backup.env first (keys are listed in ops/backup/backup.sh)" >&2; exit 1; }
chmod 0600 /etc/fuzzball/backup.env
here="$(cd "$(dirname "$0")" && pwd)"
install -m 0755 "$here/backup.sh" /usr/local/sbin/fuzzball-backup
install -m 0644 "$here/fuzzball-backup.service" "$here/fuzzball-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now fuzzball-backup.timer
echo "Test it now: systemctl start fuzzball-backup.service && journalctl -u fuzzball-backup -n 20"
