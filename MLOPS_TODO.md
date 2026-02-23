# MLOps TODO (Web Frontend)

1) Config via .env and CI environment
- VITE_BACKEND_URL, WS URL, feature flags

2) CI
- Lint, typecheck, build
- Cypress smoke test hits /predict on staging

3) Release
- Version pinning, changelogs, artifact uploads

4) Observability
- Surface backend /readyz, /version
- Report client timings (optional)
