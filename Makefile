PREFIX ?= $(HOME)/bin
BUN ?= $(shell command -v bun 2>/dev/null || echo $(HOME)/.bun/bin/bun)

.PHONY: build install uninstall test dev relay-install relay-dev relay-deploy bump

bump:
	@VER=$$(grep -o '"version": "[^"]*"' package.json | head -1 | grep -o '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*'); \
	MAJOR=$$(echo $$VER | cut -d. -f1); \
	MINOR=$$(echo $$VER | cut -d. -f2); \
	PATCH=$$(echo $$VER | cut -d. -f3); \
	NEWPATCH=$$((PATCH + 1)); \
	NEWVER="$$MAJOR.$$MINOR.$$NEWPATCH"; \
	sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$$NEWVER\"/" package.json; \
	echo "✓ Bumped version to $$NEWVER"

build:
	@$(BUN) build src/cli.ts --compile --outfile bin/tend
	@echo "✓ Built bin/tend"

dev:
	@$(BUN) run src/cli.ts $(ARGS)

install: build
	@cp bin/tend $(PREFIX)/tend
	@chmod +x $(PREFIX)/tend
	@ln -sf $(PREFIX)/tend $(PREFIX)/td 2>/dev/null || true
	@echo "✓ Installed tend to $(PREFIX)/tend"
	@echo "✓ Symlinked td → tend"

test: build
	@mkdir -p .scratch
	@npx vitest run 2>&1 | tee .scratch/test_results.txt; \
		echo "EXIT:$$?" >> .scratch/test_results.txt

uninstall:
	@rm -f $(PREFIX)/tend $(PREFIX)/td
	@echo "✓ Removed tend and td from $(PREFIX)"

relay-install:
	@cd relay && npm install
	@echo "✓ Relay dependencies installed"

relay-dev:
	@cd relay && npx wrangler dev

relay-deploy:
	@cd relay && npx wrangler deploy
	@echo "✓ Relay deployed"
