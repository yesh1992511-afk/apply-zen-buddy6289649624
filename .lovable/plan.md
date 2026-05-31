# Phase B — VPS auto-deploy on git push

## What you get

Every push to `main` that touches `worker/**` → GitHub Actions SSHes into your VPS, runs `git pull`, rebuilds the Docker image, restarts the worker, and tails the heartbeat. No more manual `ssh` + `systemctl restart`.

## What I will build (no more questions)

1. **`worker/deploy.sh`** — idempotent VPS-side deploy script:
   - `cd /root/jobpilot && git pull --ff-only`
   - `cd worker && docker compose up -d --build`
   - `docker compose ps` + last 20 log lines for the Action output
   - Exits non-zero if the worker container isn't `running` after 15s (so the Action fails loudly)

2. **`.github/workflows/deploy-worker.yml`** — runs on push to `main` when `worker/**` or the workflow file changes:
   - Checks out repo (sanity only)
   - Installs SSH key from `${{ secrets.VPS_SSH_KEY }}`
   - Adds VPS host to `known_hosts` (strict host checking on)
   - `ssh root@${{ secrets.VPS_HOST }} 'bash -s' < worker/deploy.sh`
   - Manual `workflow_dispatch` trigger too, so you can redeploy from the Actions tab without a commit

3. **`worker/README.md`** — append a short "Auto-deploy" section explaining the 2 secrets and how to trigger a manual redeploy.

## What you do once (5 min, can't be automated)

On your VPS:
```bash
# Generate a deploy key (no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/jobpilot_deploy -N ""
cat ~/.ssh/jobpilot_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/jobpilot_deploy   # copy this whole private key
```

In your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `VPS_HOST` = your VPS IP or hostname (e.g. `srv706334.hstgr.cloud` or the IP)
- `VPS_SSH_KEY` = the private key you just copied (full `-----BEGIN…END-----` block)

That's it. Next push to `main` deploys automatically.

## Defaults I'm assuming (tell me only if wrong)

- SSH user: `root`
- Repo path on VPS: `/root/jobpilot`
- Worker runs via `docker compose` in `/root/jobpilot/worker` (matches your existing `docker-compose.yml`)
- Branch: `main`

## Out of scope (intentionally)

- Moving `.env` from VPS into GitHub (keep secrets on the VPS — safer)
- Changing what the worker actually does
- Anything Lovable-side (no UI changes in this phase)

Approve and I'll build the 2 files + README update.
