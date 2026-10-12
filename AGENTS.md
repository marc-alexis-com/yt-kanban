# Installing yt-kanban: instructions for an AI assistant

You are helping someone install yt-kanban on their own Linux server (a VPS). Follow these steps
in order. README.md explains how the app works; this file is the procedure. Ignore `deploy/`:
it is the author's own deployment on his server, an example, not needed to self-host.

## 0. Ask first (only these, in one message)

1. **Domain**: which (sub)domain should serve it, e.g. `yt.example.com`? Its DNS `A` record must
   point to the server's public IP before HTTPS can work.
2. **Login**: the app has **no authentication of its own**, on purpose. It must be protected by
   the reverse proxy. Offer: a simple password (basic auth, default), a login page that stays
   signed in for weeks (tinyauth, if they already run Traefik), or private network only
   (Tailscale / WireGuard, no public domain at all).
3. **AI triage** (optional): an Anthropic API key enables the "Sort" button
   (https://console.anthropic.com). Without one, everything else works.

Do not ask for anything else unless the server state forces you to.

## 1. Look at the server before changing anything

- `docker --version && docker compose version` (Docker with the compose plugin is required; if
  missing, install it from Docker's official instructions for the distribution).
- What already listens on 80/443: `sudo ss -tlnp | grep -E ':(80|443)\b'`. If Traefik, Caddy or
  nginx is there, **reuse it**: never start a second proxy on the same ports.
- Port 3000 on localhost must be free (`ss -tln | grep ':3000\b'`); otherwise change the left
  side of `127.0.0.1:3000:3000` in `docker-compose.yml`.

## 2. Install the app

```bash
git clone https://github.com/marc-alexis-com/yt-kanban.git ~/yt-kanban && cd ~/yt-kanban
cp .env.example .env                       # put ANTHROPIC_API_KEY=... here if they gave one
chmod 600 .env
mkdir -p data && sudo chown 1000:1000 data # the container runs as uid 1000
docker compose up -d --build
curl -s localhost:3000/api/health          # must print {"ok":true}
```

Never paste the API key in a reply or a log: write it to `.env` only.

## 3. Publish it, behind authentication

Pick the case matching step 1:

- **No proxy yet**: install Caddy (official package), then in `/etc/caddy/Caddyfile`:

  ```caddy
  yt.example.com {
  	basic_auth {
  		USERNAME HASH_FROM_caddy_hash-password
  	}
  	reverse_proxy 127.0.0.1:3000
  }
  ```

  Generate the hash with `caddy hash-password` (let the user type the password themselves, or
  generate a strong one and tell them to store it in their password manager). Then
  `sudo systemctl reload caddy`. Caddy gets the HTTPS certificate on its own.
- **Traefik already there**: remove the `ports:` section, join Traefik's Docker network, add the
  labels shown in README.md ("Putting it online"), with an existing auth middleware (basicAuth,
  tinyauth, Authelia…). Match the conventions of their other services (network name, cert
  resolver, entrypoint names).
- **nginx already there**: a `server` block with `proxy_pass http://127.0.0.1:3000;`, the usual
  proxy headers, `auth_basic` + an htpasswd file, and their usual certbot setup.
- **Private network only**: no proxy; bind to the VPN address instead of `127.0.0.1` in
  `docker-compose.yml` and skip DNS.

Make sure the firewall does not expose port 3000 publicly (Docker bypasses ufw for published
ports, which is why the compose file binds to `127.0.0.1`).

## 4. Check, then hand over

- `curl -sI https://yt.example.com` returns 401 (or a redirect to the login page) without
  credentials, and 200 with them.
- Open it, add one video (any YouTube link): title and thumbnail appear.
- If an API key was set: `curl -s localhost:3000/api/config` shows `"triage":true`.
- Tell the user: the URL, how they log in, where the data lives (`~/yt-kanban/data/kanban.db`),
  how to update (`git pull && docker compose up -d --build`) and how to back up (README.md, "Day
  to day").
