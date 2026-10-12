# Deployment on eva (yt.marc-alexis.gay)

This folder is the author's own deployment on his server, kept here as an example. It is not
needed to self-host yt-kanban: follow the main README (or AGENTS.md) instead.

- `git push eva main` (remote `eva:/srv/git/yt-kanban.git`, see `eva.map`) syncs the source to
  `/opt/docker/sites/yt-kanban/src`, installs `docker-compose.yml` (Traefik + tinyauth) and
  `triage-hints.md`, then rebuilds the image with `sudo docker compose up -d --build` (the
  `env_file` `/opt/secrets/yt-kanban.env` is root 600).
- Data: `/srv/data/yt-kanban` (`kanban.db` backed up nightly, `thumbs/`, `triage-hints.md`).
- `git push origin main` for GitHub (`marc-alexis-com/yt-kanban`, the only repository).
- Sorting rules for the AI triage: edit `triage-hints.md` here, commit, push to eva: the file is
  re-read on every triage, no restart.
