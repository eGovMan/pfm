.PHONY: setup up down logs test build lint typecheck
setup:
	./scripts/setup.sh
up:
	docker compose up -d
down:
	docker compose down
logs:
	docker compose logs -f
test:
	./scripts/smoke-tests.sh
build:
	npm run build
lint:
	npm run lint
typecheck:
	npm run typecheck
