export function cmdHelp(): void {
  process.stdout.write(`Tend — Who's stuck? Who needs you?

Usage:
  tend                          Show the departures board
  tend watch                    Live dashboard (auto-refreshes every minute)
  tend demo                     Show board with demo projects (great for first run)
  tend <project>                Show project detail + sessions
  tend init [project]           Initialize .tend/ in a project
  tend emit <state> "msg"       Emit an event (working/done/stuck/waiting/idle)
  tend clear [project]          Clear events history for a project
  tend status                   Status indicator (○ ◐N ?N ◉N)
  tend add [project] "msg"      Add a TODO (or show TODOs if no message)
  tend ack [project]            Clear done/stuck/waiting → idle
  tend switch <project>         Focus VSCode window for project
  tend relay <subcmd>           Relay management (setup|status|pull|token|share)
  tend dispatch [--dry-run]     Dispatch pending TODOs as GitHub issues to Copilot
  tend remove [project]         Remove tend from a project
  tend hook <subcmd>            Lifecycle hooks (session-start|user-prompt|stop)
  tend version                  Show version
  tend help                     Show this help
`);
}
