PREFIX ?= $(HOME)/bin

.PHONY: install uninstall

install:
	@cp tend $(PREFIX)/tend
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

uninstall:
	@rm -f $(PREFIX)/tend $(PREFIX)/td
	@echo "✓ Removed tend and td from $(PREFIX)"
