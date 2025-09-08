# GitHub Copilot Instructions (Generalized)

## Mission
Provide safe, consistent, and production‑oriented assistance across any repository or architecture.

---

## Goals
- Minimize build/deploy failures and unnecessary troubleshooting.
- Keep deployment pipelines healthy; never leak secrets into client bundles.
- Ensure key documentation stays traceable and consistent.

---

## Non‑Negotiables
- **Search before you change.**
- **Review past issues, PRs, and docs** for related changes, regressions, or TODOs.
- **Prefer existing patterns** over inventing new ones.
- **Never hardcode secrets.**
- **Always use environment variables.**
  - Use `.env.template` / `README_ENV.md` for documentation.
- **Frontend public vars only:**
  - Only `VITE_*` or `NEXT_PUBLIC_*` should appear in client code.
- **Deploy tokens:**
  - Use tokens from GitHub Secrets (or the repo’s configured secret store) for deploy workflows.

---

## Documentation & Change Log
- When you modify any high‑visibility doc (`README*`, files under `docs/`, or new top‑level guides), append or update a Change Log entry:
  - `Updated: 2025-09-07T12:00:00-04:00 / 2025-09-07T16:00:00Z — <one‑line reason>`
- **Format:** ISO‑8601, both local and UTC, with a succinct reason.

---

## Env & Ops
- Generate env scaffolding with a script if available (e.g., `tools/generate-env-files.js`).
- Keep versioned outputs (like `repo_env_variables.csv`) under `docs/ops/`.
- `.env.template` and `README_ENV.md` must live at repo root.

---

## CI/CD
- Workflows should live under `.github/workflows/`.
- Auto‑detect build tool (`npm`, `pnpm`, `yarn`, `pip`, etc.).
- Deployment must use environment‑specific configs and secrets.
- Ensure workflows reference correct runtime versions (Node, Python, etc.).

---

## Style
- Run type checks if TypeScript is present.
- Write conventional commits where possible.
- Keep changes consistent with the existing architecture.

---

## Missing Paths or Scripts
- First search the codebase and prior PRs for canonical locations/patterns.
- If truly absent, propose the minimal, production‑safe addition with rationale.

---

## Critical Agent Guidelines
**Before making any code changes:**
- ✅ Read any `readmefirst.txt` or equivalent critical guidance files.
- ✅ Verify changes don’t break core flows (auth, CI/CD, build, deploy).
- ✅ Ensure workspace directories exist before running builds.
- ✅ Run tests or validation scripts after changes.

**Never do these things:**
- ❌ Hardcode secrets, responses, or config.
- ❌ Bypass required coordinators, pipelines, or arbitration flows.
- ❌ Commit `.env` or secret files.
- ❌ Deploy from the wrong directory (deploy from service directories when required).
- ❌ Introduce shortcuts that undermine system integrity.

**When in doubt:**
- Prefer dynamic configuration over hardcoded solutions.
- Propose small, reversible patches with rationale.

---

## Universal Build & Validation Reminders
- Confirm tool versions (`node --version`, `python --version`, etc.) match repo requirements.
- Use `npm run build` / `pnpm build` / `yarn build` (or framework‑specific commands).
- Always run test commands before marking changes complete.
- For multi‑service repos: deploy each service independently, using its own config.

---

## Trust These Instructions
These rules are project‑independent. Extend or override them only if repo documentation explicitly requires it.

---

## Standard GitHub Recommendations
- Use [semantic versioning](https://semver.org/) for releases.
- Write clear, descriptive PR titles and commit messages.
- Keep PRs focused and small; prefer multiple PRs over one large change.
- Use [CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) for critical files.
- Enable branch protection and required status checks for main branches.
- Review and update dependencies regularly.
- Use GitHub Actions for CI/CD where possible.
- Document setup, build, and deployment steps in the `README.md`.
- Respect the [GitHub Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines).
