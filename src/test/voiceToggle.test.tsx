import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VoiceToggle } from '@/components/broadcast/VoiceToggle';
import { useVoiceStore } from '@/stores/voiceStore';

// The stores capture localStorage when they're created, so it has to exist before the imports run
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
});

describe('the voice button', () => {
  beforeEach(() => useVoiceStore.getState().setVoiceOn(true));

  it('mutes and unmutes in one tap, and says which it is', () => {
    render(<VoiceToggle />);
    const button = screen.getByRole('switch', { name: 'Coach voice' });
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(button).toHaveTextContent('Voice');

    fireEvent.click(button);
    expect(useVoiceStore.getState().voiceOn).toBe(false);
    expect(button).toHaveAttribute('aria-checked', 'false');
    expect(button).toHaveTextContent('Muted');

    fireEvent.click(button);
    expect(useVoiceStore.getState().voiceOn).toBe(true);
  });

  it('every copy on a screen is the same switch', () => {
    render(
      <>
        <VoiceToggle />
        <VoiceToggle compact />
      </>,
    );
    const [full, compact] = screen.getAllByRole('switch', { name: 'Coach voice' });
    fireEvent.click(compact);
    expect(full).toHaveAttribute('aria-checked', 'false');
  });

  it('remembers the setting', () => {
    useVoiceStore.getState().setVoiceOn(false);
    expect(JSON.parse(localStorage.getItem('get-clocked-voice')!).state).toEqual({ voiceOn: false });
  });
});
