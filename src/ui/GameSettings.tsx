import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { Settings, Quality } from '../game/types';
export function GameSettings({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog">
        <span className="eyebrow">MAKE IT YOURS</span>
        <DialogTitle>Race settings</DialogTitle>
        <DialogDescription>
          Find your balance of detail and performance.
        </DialogDescription>
        <div className="settings-section">
          <span className="eyebrow">GRAPHICS</span>
          <RadioGroup
            value={settings.quality}
            onValueChange={(v) =>
              onChange({ ...settings, quality: v as Quality })
            }
            aria-label="Graphics quality"
          >
            {[
              ['eco', 'Eco', '720p budget · lighter GPU load'],
              ['balanced', 'Balanced', '1080p budget · adaptive detail'],
              ['ultra', 'Ultra', '1440p budget · maximum detail'],
            ].map(([value, label, note]) => (
              <label
                className={`quality-option ${settings.quality === value ? 'selected' : ''}`}
                key={value}
              >
                <RadioGroupItem value={value} />
                <span>
                  <b>{label}</b>
                  <small>{note}</small>
                </span>
                {value === 'balanced' && <em>DEFAULT</em>}
              </label>
            ))}
          </RadioGroup>
          <p className="setting-note">
            Racing is capped at 60 FPS. Menus run at 30 FPS. Rendering pauses in
            hidden tabs.
          </p>
        </div>
        <label className="setting-row" htmlFor="steering-assist">
          <span>
            <b>Steering assistance</b>
            <small>A little help holding your line through corners.</small>
          </span>
          <Switch
            id="steering-assist"
            checked={settings.assists}
            onCheckedChange={(v) => onChange({ ...settings, assists: v })}
          />
        </label>
        <label className="setting-row" htmlFor="engine-sound">
          <span>
            <b>Engine & track audio</b>
            <small>Engine note, wind and tire feedback.</small>
          </span>
          <Switch
            id="engine-sound"
            checked={settings.sound}
            onCheckedChange={(v) => onChange({ ...settings, sound: v })}
          />
        </label>
        <div className="controls-guide">
          <span className="eyebrow">THE CONTROLS</span>
          <div>
            <kbd>W / ↑</kbd>
            <span>Accelerate</span>
            <kbd>S / ↓</kbd>
            <span>Brake</span>
            <kbd>A D / ← →</kbd>
            <span>Steer</span>
            <kbd>SHIFT</kbd>
            <span>Overtake boost</span>
            <kbd>C</kbd>
            <span>Camera</span>
            <kbd>R</kbd>
            <span>Reset to track</span>
            <kbd>ESC</kbd>
            <span>Pause</span>
            <kbd>M</kbd>
            <span>Mute audio</span>
          </div>
          <p>
            Controller: left stick to steer, RT / LT for pedals, A for boost, Y
            for camera.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
