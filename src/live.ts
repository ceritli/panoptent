// Live mode (`/panoptent live` in Claude Code).
//
// Claude Code can't be sent a message from outside, but it wakes up when a background command it
// started finishes. So the `/panoptent live` skill tells Claude to run a long-poll request against the
// Panoptent MCP server (`GET /panoptent/live/wait`) as a background task. When the user presses Apply,
// the waiting request returns the change-set id; Claude fetches it with `get_apply`, makes the edits,
// calls `mark_applied` and starts waiting again. No paste, no Enter.
//
// This module only holds the hand-off state; the HTTP endpoint lives in mcp.ts.

export type LiveEvent =
  | { type: 'apply'; id: string; summary?: string }
  | { type: 'timeout' }
  | { type: 'stop' };

interface Waiter {
  resolve: (ev: LiveEvent) => void;
  timer: NodeJS.Timeout;
}

/** After an event is handed over, Claude is working on it and has no wait open; it still counts as listening. */
const BUSY_GRACE = 30 * 60 * 1000;
/** After a timeout reply Claude re-runs the wait right away; if it doesn't, the session is gone. */
const RECONNECT_GRACE = 60 * 1000;

export class LiveHub {
  private waiters = new Set<Waiter>();
  private queue: LiveEvent[] = [];
  private stopped = true;
  private lastEnd: 'event' | 'timeout' | 'aborted' | '' = '';
  private lastEndAt = 0;
  private listeners = new Set<(on: boolean) => void>();
  private wasActive = false;

  /** Is a Claude Code session listening (waiting now, or busy with the last event)? */
  get active(): boolean {
    if (this.stopped) return false;
    if (this.waiters.size) return true;
    const age = Date.now() - this.lastEndAt;
    if (this.lastEnd === 'event') return age < BUSY_GRACE;
    if (this.lastEnd === 'timeout') return age < RECONNECT_GRACE;
    return false;
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return { dispose: () => this.listeners.delete(fn) };
  }

  private changed() {
    const now = this.active;
    if (now === this.wasActive) return;
    this.wasActive = now;
    for (const f of this.listeners) {
      try {
        f(now);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Long-poll: resolves with the next event, or `timeout` after `ms`.
   * `onAbort` lets the caller report that the client went away (Claude Code session closed).
   */
  wait(ms: number): { result: Promise<LiveEvent>; abort: () => void } {
    this.stopped = false;
    const queued = this.queue.shift();
    if (queued) {
      this.end('event');
      return { result: Promise.resolve(queued), abort: () => {} };
    }
    let waiter!: Waiter;
    const result = new Promise<LiveEvent>((resolve) => {
      waiter = {
        resolve: (ev) => {
          clearTimeout(waiter.timer);
          if (!this.waiters.delete(waiter)) return;
          this.end(ev.type === 'apply' ? 'event' : ev.type === 'timeout' ? 'timeout' : 'aborted');
          resolve(ev);
        },
        timer: setTimeout(() => waiter.resolve({ type: 'timeout' }), ms),
      };
      this.waiters.add(waiter);
    });
    this.changed();
    return {
      result,
      abort: () => {
        clearTimeout(waiter.timer);
        if (!this.waiters.delete(waiter)) return;
        this.end('aborted');
      },
    };
  }

  private end(how: 'event' | 'timeout' | 'aborted') {
    // a newer wait is already open: it decides
    if (!this.waiters.size) {
      this.lastEnd = how;
      this.lastEndAt = Date.now();
    }
    this.changed();
  }

  /** Hands an apply to the listening session. Returns false when nobody is listening. */
  deliver(ev: Extract<LiveEvent, { type: 'apply' }>): boolean {
    if (!this.active) return false;
    const w = this.waiters.values().next().value as Waiter | undefined;
    if (w) w.resolve(ev);
    else {
      this.queue.push(ev); // Claude is still busy with the previous one; it picks this up on its next wait
      this.lastEndAt = Date.now();
    }
    return true;
  }

  /** `/panoptent stop` or the user turned it off: end every open wait. */
  stop() {
    this.stopped = true;
    this.queue = [];
    for (const w of [...this.waiters]) w.resolve({ type: 'stop' });
    this.lastEnd = '';
    this.changed();
  }

  dispose() {
    this.stop();
    this.listeners.clear();
  }
}
