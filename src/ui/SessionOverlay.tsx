import {
  Play,
  RotateCcw,
  ArrowLeft,
  SlidersHorizontal,
  Trophy,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatTime, type Telemetry } from '../game/types';
export function SessionOverlay({
  data,
  onResume,
  onRestart,
  onMenu,
  onSettings,
}: {
  data: Telemetry;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onSettings: () => void;
}) {
  const finished = data.phase === 'finished',
    open = finished || data.phase === 'paused';
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !finished) onResume();
      }}
    >
      <DialogContent className="session-dialog" showCloseButton={false}>
        <span className="eyebrow">
          {finished ? 'CHEQUERED FLAG' : 'TAKE A BREATHER'}
        </span>
        {finished && <Trophy className="result-trophy" size={32} />}
        <DialogTitle>
          {finished
            ? data.finishedPosition === 1
              ? 'Victory.'
              : 'Race complete.'
            : 'In the pits.'}
        </DialogTitle>
        <DialogDescription>
          {finished
            ? data.newBest
              ? 'A new personal best. Nicely driven.'
              : 'Every lap makes you faster.'
            : 'Your race is paused. Ready when you are.'}
        </DialogDescription>
        {finished && (
          <div className="results-grid">
            <div>
              <span>POSITION</span>
              <strong>P{data.finishedPosition}</strong>
            </div>
            <div>
              <span>BEST LAP</span>
              <strong>{formatTime(data.bestLap)}</strong>
            </div>
            <div>
              <span>RACE TIME</span>
              <strong>{formatTime(data.raceTime)}</strong>
            </div>
          </div>
        )}
        <Button
          className="start-race"
          onClick={finished ? onRestart : onResume}
        >
          {finished ? 'RACE AGAIN' : 'BACK TO RACING'}
          {finished ? <ArrowUpRight /> : <Play />}
        </Button>
        {!finished && (
          <>
            <Button
              className="overlay-action"
              variant="ghost"
              onClick={onRestart}
            >
              <RotateCcw size={16} />
              Restart race
            </Button>
            <Button
              className="overlay-action"
              variant="ghost"
              onClick={onSettings}
            >
              <SlidersHorizontal size={16} />
              Settings
            </Button>
          </>
        )}
        <Button className="overlay-action" variant="ghost" onClick={onMenu}>
          <ArrowLeft size={16} />
          Back to circuits
        </Button>
      </DialogContent>
    </Dialog>
  );
}
