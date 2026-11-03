import { cn } from '@/lib/utils';
import { useVoiceStore } from '@/stores/voiceStore';
import { SpeakerIcon, SpeakerOffIcon } from './icons';

/**
 * One tap to mute or unmute the app's spoken voice, from any screen that talks.
 * The same switch as Coach Voice in Settings. Beeps and bells follow their own settings.
 */
export function VoiceToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const voiceOn = useVoiceStore((state) => state.voiceOn);
  const toggleVoice = useVoiceStore((state) => state.toggleVoice);
  const Icon = voiceOn ? SpeakerIcon : SpeakerOffIcon;

  return (
    <button
      type="button"
      onClick={toggleVoice}
      role="switch"
      aria-label="Coach voice"
      aria-checked={voiceOn}
      data-state={voiceOn ? 'checked' : 'unchecked'}
      title={voiceOn ? 'Mute the coach voice' : 'Turn the coach voice back on'}
      data-testid="voice-toggle"
      className={cn('plate fx h-11 gap-1.5', compact ? 'w-11 shrink-0 px-0' : 'px-3', voiceOn ? 'plate-white' : 'plate-graphite', className)}
    >
      <Icon className={compact ? 'size-5' : 'size-4'} />
      {!compact && (voiceOn ? 'Voice' : 'Muted')}
    </button>
  );
}
