# Deployment on eva (yt.marc-alexis.gay)

This folder is only for the author's server and is left out of the public copy of the repo.

- `git push eva main` (remote `eva:/srv/git/yt-kanban.git`, see `eva.map`) syncs the source to
  `/opt/docker/sites/yt-kanban/src`, installs `docker-compose.yml` (Traefik + tinyauth) and
  `triage-hints.md`, then rebuilds the image with `sudo docker compose up -d --build` (the
  `env_file` `/opt/secrets/yt-kanban.env` is root 600).
- Data: `/srv/data/yt-kanban` (`kanban.db` backed up nightly, `thumbs/`, `triage-hints.md`).
- `git push origin main` for the private GitHub repo (`marc-alexis-com/yt-kanban-eva`).
- **Public copy** (`marc-alexis-com/yt-kanban`, shared with friends): `./deploy/publish-public.sh "feat: …"`
  publishes everything tracked except `deploy/` as one new commit there.
- Sorting rules for the AI triage: edit `triage-hints.md` here, commit, push to eva: the file is
  re-read on every triage, no restart.
