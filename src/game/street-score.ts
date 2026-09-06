export const SPEED_TRAPS = [0.18, 0.52, 0.83] as const;

/** Bank a clean chain after two seconds; contact loses the unbanked chain. */
export class StreetScore {
  total = 0;
  chain = 0;
  multiplier = 1;
  drifting = false;
  message = '';
  private quiet = 0;
  private messageTime = 0;
  update(dt: number, speed: number, slipAngle: number, offTrack: boolean) {
    this.messageTime = Math.max(0, this.messageTime - dt);
    if (!this.messageTime) this.message = '';
    this.drifting = speed > 12 && Math.abs(slipAngle) > 0.15 && !offTrack;
    if (this.drifting) {
      this.chain += dt * speed * Math.min(1.2, Math.abs(slipAngle) * 3) * 7;
      this.multiplier = Math.min(5, 1 + Math.floor(this.chain / 450));
      this.quiet = 0;
    } else {
      this.quiet += dt;
      if (this.quiet >= 2) this.bank();
    }
    if (offTrack && this.chain > 0) this.breakChain();
  }
  award(label: string, points: number) {
    this.chain += points;
    this.multiplier = Math.min(5, 1 + Math.floor(this.chain / 450));
    this.quiet = 0;
    this.message = `${label} +${points}`;
    this.messageTime = 1.8;
  }
  bank() {
    if (this.chain > 0) {
      const amount = Math.floor(this.chain * this.multiplier);
      this.total += amount;
      this.message = `BANKED +${amount.toLocaleString('en-US')}`;
      this.messageTime = 1.8;
    }
    this.chain = 0;
    this.multiplier = 1;
    this.drifting = false;
  }
  breakChain() {
    if (this.chain > 0) {
      this.message = 'CHAIN LOST';
      this.messageTime = 1.3;
    }
    this.chain = 0;
    this.multiplier = 1;
    this.drifting = false;
    this.quiet = 0;
  }
}
