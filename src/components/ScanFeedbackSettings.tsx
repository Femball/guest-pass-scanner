import { Vibrate, Volume2, VolumeX } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useScanPreferences } from '@/hooks/useScanPreferences';

const ScanFeedbackSettings = () => {
  const { preferences, setSound, setVibration } = useScanPreferences();

  return (
    <section
      aria-labelledby="scan-feedback-title"
      className="w-full max-w-sm rounded-xl border border-border bg-background/80 backdrop-blur-sm p-3"
    >
      <h2 id="scan-feedback-title" className="text-sm font-semibold text-foreground mb-2">
        Retour après scan
      </h2>
      <div className="flex items-center justify-between gap-3 py-1.5">
        <Label htmlFor="scan-sound" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          {preferences.sound ? (
            <Volume2 className="w-4 h-4" aria-hidden="true" />
          ) : (
            <VolumeX className="w-4 h-4" aria-hidden="true" />
          )}
          Signal sonore
        </Label>
        <Switch
          id="scan-sound"
          checked={preferences.sound}
          onCheckedChange={setSound}
          aria-label="Activer le signal sonore après chaque scan"
        />
      </div>
      <div className="flex items-center justify-between gap-3 py-1.5">
        <Label htmlFor="scan-vibration" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Vibrate className="w-4 h-4" aria-hidden="true" />
          Vibration
        </Label>
        <Switch
          id="scan-vibration"
          checked={preferences.vibration}
          onCheckedChange={setVibration}
          aria-label="Activer la vibration après chaque scan"
        />
      </div>
    </section>
  );
};

export default ScanFeedbackSettings;
