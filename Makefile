.PHONY: ci ci-app ci-api \
	app-lint app-test app-build app-e2e \
	api-lint api-test playwright-install

ci: ci-app ci-api

ci-app: app-lint app-test app-build app-e2e

ci-api: api-lint api-test

app-lint:
	npm run app:lint

app-test:
	npm run app:test

app-build:
	npm run app:build

app-e2e: playwright-install
	npm run app:test:e2e

api-lint:
	npm run api:lint

api-test:
	npm run api:test

playwright-install:
	cd app && npx playwright install --with-deps >/dev/null 2>&1 || true
