import { clamp } from './tracks';
export interface ControlInput {
  steer: number;
  throttle: number;
  brake: number;
  boost: boolean;
}
export class Input {
  keys = new Set<string>();
  touch = { steer: 0, throttle: 0, brake: 0, boost: false };
  enabled = false;
  gamepadConnected = false;
  private disposers: (() => void)[] = [];
  onAction: (action: string) => void = () => {};
  constructor() {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,select,textarea')) return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        ) &&
        this.enabled
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) {
        const actions: Record<string, string> = {
          Escape: 'pause',
          KeyP: 'pause',
          KeyC: 'camera',
          KeyR: 'reset',
          Enter: 'enter',
          KeyM: 'mute',
        };
        if (actions[e.code]) this.onAction(actions[e.code]);
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => {
      this.clear();
      this.onAction('blur');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    this.disposers.push(
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => window.removeEventListener('blur', blur),
    );
  }
  private lastButtons: boolean[] = [];
  read(): ControlInput {
    let steer =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touch.steer;
    let throttle =
      this.keys.has('KeyW') || this.keys.has('ArrowUp')
        ? 1
        : this.touch.throttle;
    let brake =
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown') ||
      this.keys.has('Space')
        ? 1
        : this.touch.brake;
    let boost =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touch.boost;
    const pad = navigator.getGamepads?.()?.find((p) => p?.connected);
    this.gamepadConnected = !!pad;
    if (pad) {
      let x = pad.axes[0] ?? 0;
      if (Math.abs(x) < 0.1) x = 0;
      else x = (Math.sign(x) * (Math.abs(x) - 0.1)) / 0.9;
      steer = Math.abs(x) > Math.abs(steer) ? x : steer;
      throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0);
      brake = Math.max(brake, pad.buttons[6]?.value ?? 0);
      boost ||= !!pad.buttons[0]?.pressed;
      for (const [index, action] of [
        [9, 'pause'],
        [3, 'camera'],
        [2, 'reset'],
      ] as const) {
        const b = !!pad.buttons[index]?.pressed;
        if (b && !this.lastButtons[index]) this.onAction(action);
        this.lastButtons[index] = b;
      }
    }
    return { steer: clamp(steer, -1, 1), throttle, brake, boost };
  }
  clear() {
    this.keys.clear();
    this.touch = { steer: 0, throttle: 0, brake: 0, boost: false };
  }
  dispose() {
    this.disposers.forEach((d) => d());
    this.clear();
  }
}
