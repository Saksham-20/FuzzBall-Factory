# pg_hba.conf for this server

Edit `/etc/postgresql/<version>/main/pg_hba.conf` so the only rules that remain are local ones:

```
local   all       postgres                     peer
local   all       all                          peer
host    fuzzball  fuzzball   127.0.0.1/32      scram-sha-256
host    fuzzball  fuzzball   ::1/128           scram-sha-256
```

Remove every `host ... 0.0.0.0/0` or `::/0` line, then `sudo systemctl reload postgresql`. With `listen_addresses =
'localhost'` (fuzzball.conf) the port is closed to the internet anyway; this is the second lock. Check from another
machine that `nc -zv <server> 5432` fails, and that `ufw status` does not list 5432.
