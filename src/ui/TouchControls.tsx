import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ControlInput } from '../game/input';
export function TouchControls({
  onInput,
}: {
  onInput: (key: keyof ControlInput, value: number | boolean) => void;
}) {
  const press = (
    event: React.PointerEvent,
    key: keyof ControlInput,
    value: number | boolean,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onInput(key, value);
  };
  const release = (key: keyof ControlInput) =>
    onInput(key, key === 'boost' || key === 'handbrake' ? false : 0);
  return (
    <div className="touch-controls">
      <div>
        <Button
          aria-label="Steer left"
          onPointerDown={(e) => press(e, 'steer', -1)}
          onPointerUp={() => release('steer')}
          onPointerCancel={() => release('steer')}
        >
          <ArrowLeft />
        </Button>
        <Button
          aria-label="Steer right"
          onPointerDown={(e) => press(e, 'steer', 1)}
          onPointerUp={() => release('steer')}
          onPointerCancel={() => release('steer')}
        >
          <ArrowRight />
        </Button>
      </div>
      <div>
        <Button
          aria-label="Nitro"
          onPointerDown={(e) => press(e, 'boost', true)}
          onPointerUp={() => release('boost')}
          onPointerCancel={() => release('boost')}
        >
          NITRO
        </Button>
        <Button
          aria-label="Handbrake drift"
          onPointerDown={(e) => press(e, 'handbrake', true)}
          onPointerUp={() => release('handbrake')}
          onPointerCancel={() => release('handbrake')}
        >
          DRIFT
        </Button>
        <Button
          aria-label="Brake"
          onPointerDown={(e) => press(e, 'brake', 1)}
          onPointerUp={() => release('brake')}
          onPointerCancel={() => release('brake')}
        >
          BRAKE
        </Button>
        <Button
          aria-label="Accelerate"
          onPointerDown={(e) => press(e, 'throttle', 1)}
          onPointerUp={() => release('throttle')}
          onPointerCancel={() => release('throttle')}
        >
          GO
        </Button>
      </div>
    </div>
  );
}
