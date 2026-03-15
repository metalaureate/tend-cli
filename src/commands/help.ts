export function cmdHelp(): void {
  process.stdout.write(`Tend — What's running? What needs me?

Usage:
  tend                          Show the departures board
  tend <project>                Show project detail + sessions
  tend init [project]           Initialize .tend/ in a project
  tend emit <state> "msg"       Emit an event (working/done/stuck/waiting/idle)
  tend clear [project]          Clear events history for a project
  tend status                   Status indicator (○ ◉N ▲N ◆N)
  tend add [project] "msg"      Add a TODO (or show TODOs if no message)
  tend ack [project]            Clear done/stuck/waiting → idle
  tend switch <project>         Focus VSCode window for project
  tend sync [project]           Generate reconciliation prompt
  tend relay <subcmd>           Relay management (setup|status|pull|token)
  tend hook <subcmd>            Lifecycle hooks (session-start|user-prompt|stop)
  tend version                  Show version
  tend help                     Show this help
`);
}
