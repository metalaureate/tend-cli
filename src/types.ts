export type State = 'working' | 'done' | 'stuck' | 'waiting' | 'idle';

export const VALID_STATES: readonly State[] = ['working', 'done', 'stuck', 'waiting', 'idle'];

export function isValidState(s: string): s is State {
  return VALID_STATES.includes(s as State);
}

export interface TendEvent {
  ts: string;
  sessionId: string;
  state: State;
  message: string;
}

export interface SessionState {
  state: State;
  ts: string;
  message: string;
}

export interface ProjectState {
  state: State;
  message: string;
  ts: string;
  activeCount: number;
  workingTimestamps: string[];
}

export interface ProjectInfo {
  path: string;
  name: string;
}

export const STATE_PRIORITY: Record<State, number> = {
  stuck: 5,
  waiting: 4,
  working: 3,
  done: 2,
  idle: 0,
};
