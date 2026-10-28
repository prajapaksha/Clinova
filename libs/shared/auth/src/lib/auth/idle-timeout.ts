import { DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { STAFF_IDLE_TIMEOUT_MINUTES } from '@clinova/identity/domain';
import { AuthService } from './auth';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
const ACTIVITY_KEY = 'clv_last_activity';
export const IDLE_WARNING_SECONDS = 60;

/**
 * Signs staff out after STAFF_IDLE_TIMEOUT_MINUTES without activity (PRD §5.1),
 * with a countdown warning for the last minute. Activity in any tab counts.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeout {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);

  /** Seconds left before automatic sign-out while the warning is showing, otherwise null. */
  readonly secondsLeft = signal<number | null>(null);

  private timeoutMs = STAFF_IDLE_TIMEOUT_MINUTES * 60_000;
  private lastActivity = Date.now();
  private lastPersisted = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onActivity = () => this.recordActivity();
  private readonly onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVITY_KEY && e.newValue) this.lastActivity = Math.max(this.lastActivity, Number(e.newValue));
  };

  /** Starts watching; stops automatically when `destroyRef` is destroyed. */
  start(destroyRef: DestroyRef, timeoutMs = this.timeoutMs): void {
    this.stop();
    this.timeoutMs = timeoutMs;
    this.lastActivity = Date.now();
    const win = this.document.defaultView;
    this.zone.runOutsideAngular(() => {
      for (const evt of ACTIVITY_EVENTS) this.document.addEventListener(evt, this.onActivity, { passive: true });
      win?.addEventListener('storage', this.onStorage);
      this.timer = setInterval(() => this.tick(), 1000);
    });
    destroyRef.onDestroy(() => this.stop());
  }

  stop(): void {
    for (const evt of ACTIVITY_EVENTS) this.document.removeEventListener(evt, this.onActivity);
    this.document.defaultView?.removeEventListener('storage', this.onStorage);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.secondsLeft.set(null);
  }

  /** "Stay signed in" from the warning. */
  extend(): void {
    this.recordActivity(true);
  }

  private recordActivity(force = false): void {
    // While warning, only an explicit choice keeps the session (stray mouse moves don't).
    if (this.secondsLeft() !== null && !force) return;
    this.lastActivity = Date.now();
    if (this.lastActivity - this.lastPersisted > 5000) {
      this.lastPersisted = this.lastActivity;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(this.lastActivity));
      } catch {
        // Storage may be unavailable (private mode); single-tab tracking still works.
      }
    }
    if (force) this.secondsLeft.set(null);
  }

  private tick(): void {
    const remainingMs = this.timeoutMs - (Date.now() - this.lastActivity);
    if (remainingMs <= 0) {
      this.zone.run(() => {
        this.stop();
        this.auth.signOut('idle');
      });
      return;
    }
    const seconds = Math.ceil(remainingMs / 1000);
    const next = seconds <= IDLE_WARNING_SECONDS ? seconds : null;
    if (next !== this.secondsLeft()) this.zone.run(() => this.secondsLeft.set(next));
  }
}
