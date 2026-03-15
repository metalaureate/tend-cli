PREFIX ?= $(HOME)/bin

.PHONY: install uninstall test relay-install relay-dev relay-deploy

install:
	@cp bin/tend $(PREFIX)/tend
	@chmod +x $(PREFIX)/tend
	@ln -sf $(PREFIX)/tend $(PREFIX)/td 2>/dev/null || true
	@echo "✓ Installed tend to $(PREFIX)/tend"
	@echo "✓ Symlinked td → tend"
	@echo ""
	@echo "Add to your shell prompt:"
	@echo "  # zsh"
	@echo "  PROMPT='\%~ \$$(tend prompt) \%# '"
	@echo "  # bash"
	@echo "  export PS1='\\w \$$(tend prompt) \\$$$ '"

test:
	@mkdir -p .scratch
	@bash test/test_tend.sh > .scratch/test_results.txt 2>&1; \
		echo "EXIT:$$?" >> .scratch/test_results.txt; \
		tail -5 .scratch/test_results.txt

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
