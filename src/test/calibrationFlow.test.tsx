import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalibrationFlow } from '@/components/punch/CalibrationFlow';
import { Calibration, type CalibrationActions, type CalibrationView } from '@/lib/punch/calibration';

const speech = vi.hoisted(() => ({ speak: vi.fn(), initialize: vi.fn() }));
const stance = vi.hoisted(() => ({ setStance: vi.fn() }));

vi.mock('@/hooks/useSpeechSynthesis', () => ({ useSpeechSynthesis: () => ({ ...speech, cancel: vi.fn() }), useVoicePreload: () => undefined }));
vi.mock('@/hooks/useStance', () => ({ useStance: () => ({ stance: 'orthodox', hasChosen: true, setStance: stance.setStance }) }));

const actions = (): CalibrationActions => ({
  begin: vi.fn(),
  skip: vi.fn(),
  skipStep: vi.fn(),
  retryPunch: vi.fn(),
  skipPunch: vi.fn(),
  finish: vi.fn(),
  restart: vi.fn(),
});

const viewAt = (drive: (calibration: Calibration) => void): CalibrationView => {
  const calibration = new Calibration();
  drive(calibration);
  return calibration.view();
};

describe('CalibrationFlow', () => {
  it('opens with Calibrate and Skip calibration', () => {
    const act = actions();
    render(<CalibrationFlow calibration={viewAt(() => undefined)} actions={act} onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate' }));
    expect(speech.initialize).toHaveBeenCalled();
    expect(act.begin).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip calibration' }));
    expect(act.skip).toHaveBeenCalled();
  });

  it('shows the framing problem during setup, with do and don’t lines', () => {
    const view = viewAt((c) => {
      c.begin();
      c.push(0, 'no_person', null, null);
    });
    render(<CalibrationFlow calibration={view} actions={actions()} onStart={vi.fn()} />);
    expect(screen.getByTestId('calibration-framing')).toHaveTextContent("Can't see anyone");
    expect(screen.getByText(/Don't put the phone behind the bag/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip setup' })).toBeInTheDocument();
  });

  it('prompts a punch out loud and on screen, and offers a retry after a miss', () => {
    const act = actions();
    const waiting = viewAt((c) => {
      c.begin();
      c.skipStep();
      c.skipStep();
    });
    const { rerender } = render(<CalibrationFlow calibration={waiting} actions={act} onStart={vi.fn()} />);
    expect(screen.getByTestId('calibration-prompt')).toHaveTextContent('1 Jab');
    expect(speech.speak).toHaveBeenLastCalledWith('Throw a jab', expect.anything());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    const missed = viewAt((c) => {
      c.begin();
      c.skipStep();
      c.skipStep();
      c.push(10_000, 'ok', null, null);
    });
    rerender(<CalibrationFlow calibration={missed} actions={act} onStart={vi.fn()} />);
    expect(screen.getByTestId('calibration-step-line')).toHaveTextContent("Didn't see it.");
    expect(screen.getByTestId('calibration-tip')).toHaveTextContent(/fully extended/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(act.retryPunch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip punch' }));
    expect(act.skipPunch).toHaveBeenCalled();
  });

  it('ends on what to expect, and Start finishes calibration and starts the session', () => {
    const act = actions();
    const onStart = vi.fn();
    const view = viewAt((c) => {
      c.begin();
      c.skipStep();
      c.skipStep();
      for (let i = 0; i < 6; i += 1) c.skipPunch();
    });
    render(<CalibrationFlow calibration={view} actions={act} onStart={onStart} startLabel="Start session" />);
    expect(screen.getByText('Saw 0 of 6 punches.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(act.finish).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Calibrate again' }));
    expect(act.restart).toHaveBeenCalled();
  });

  it('says what to expect from the spot when the guard hold ran', () => {
    const view: CalibrationView = {
      ...viewAt((c) => c.begin()),
      phase: 'result',
      result: {
        framed: true, headCut: false, legsCut: false, scale: 0.3, cameraAngle: 90, cameraSide: 'side_left', cameraHeight: 'level', stance: 'southpaw', guard: null, gaveUp: false, shaky: false, seenShare: 1, handsHidden: false,
      },
    };
    render(<CalibrationFlow calibration={view} actions={actions()} onStart={vi.fn()} />);
    expect(screen.getByTestId('calibration-expect')).toHaveTextContent(/^From here: it counts most punches, with a few extra/);
    fireEvent.click(screen.getByRole('button', { name: 'You look southpaw. Switch?' }));
    expect(stance.setStance).toHaveBeenCalledWith('southpaw');
  });
});
