PREFIX ?= $(HOME)/bin
BUN ?= $(shell command -v bun 2>/dev/null || echo $(HOME)/.bun/bin/bun)

.PHONY: build install uninstall test dev relay-install relay-dev relay-deploy bump

bump:
	@OLD=$$(grep -o '"version": "[^"]*"' package.json | head -1 | grep -o '[0-9]*$$'); \
	NEW=$$((OLD + 1)); \
	FULL=$$(grep -o '"version": "[^"]*"' package.json | head -1 | sed "s/\.[0-9]*\"/.$$NEW\"/"); \
	VER=$$(echo $$FULL | grep -o '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*'); \
	sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$$VER\"/" package.json; \
	sed -i '' "s/TEND_VERSION = '[^']*'/TEND_VERSION = '$$VER'/" src/core/config.ts; \
	echo "✓ Bumped version to $$VER"

build: bump
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
