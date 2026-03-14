## Tend Integration

This project uses Tend for workflow coordination.

### On Startup

1. Read `.tend/TODO` to understand the current backlog.

### Emitting State Changes

When your work state changes, append a line to `.tend/events`:

```
<ISO-8601-timestamp> <state> <message>
```

States: `working`, `done`, `stuck`, `waiting`, `idle`

Use the tend CLI if available:
```bash
tend emit working "<what you're starting>"
tend emit done "<summary of what you completed>"
tend emit stuck "<what you need from the human>"
tend emit idle
```

Or append directly:
```bash
echo "$(date +%Y-%m-%dT%H:%M:%S) working <description>" >> .tend/events
```

### On Completion

- If there are items in `.tend/TODO`, note the next item but wait for the developer to assign it.

## Testing

Run the test suite before committing any changes to the `tend` script:

```bash
bash test/test_tend.sh
```

- All 49 tests must pass (91 assertions).
- Tests use isolated temp directories — no impact on real projects or shell config.
- If you add a new command or change behavior, add a corresponding test to `test/test_tend.sh`.
- Tests should be self-contained: each test calls `setup` (creates temp dirs) and `teardown` (cleans up).
- Use the existing assertion helpers: `assert_eq`, `assert_contains`, `assert_not_contains`, `assert_file_exists`, `assert_exit`.
