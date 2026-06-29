# Hermes Agents

Infrastructure for running Hermes agent workloads on AWS.

## Architecture
```
+-------------------+         ssh         +-------------------+
|  Laptop (this)    |  ───────────────▶   |  AWS EC2          |
|  - Kilo CLI       |                      |  - Hermes agents  |
|  - planning, code |                      |  - heavier agent  |
|  - Git, VS Code   |                      |    workloads      |
+-------------------+                      +-------------------+
```

The laptop is the **command center**: planning, editing, git, SSH, Kilo.
AWS does the **heavy agent lifting**.

## SSH access
```bash
ssh aws                  # uses ~/.ssh/config Host alias
```

Config lives at `~/.ssh/config` (see comment block for placeholders).
Backend host details and bastion template are documented in
`../_ops/SSH_AWS_REFERENCE.md`.

## Repos under this folder
Each subdirectory should be a separate git repo (or a clone of one on the
EC2 host). Keep this folder organized by project name, not by date.

## Local vs remote files
- **Local-only** (laptop): editor config, secrets, SSH keys.
- **Remote** (EC2): agent runtimes, prompts, large datasets, model weights.
- **Both**: code, configs, small data.

## Secrets
- AWS keys in `~/.aws/credentials` (never in this repo).
- API keys for models in `.env` files (use `.env.example` to document).
