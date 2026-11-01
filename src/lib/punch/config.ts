/**
 * Every tunable number for punch detection, in one place.
 *
 * Set from boxing biomechanics and synthetic motion, then adjusted against one recording of one
 * person on one camera (2026-11-01, odd reps only, even reps held out). That is thin evidence, so
 * treat them as starting points and expect to change them as more people use this.
 *
 * The form limits have less behind them: nobody knows which reps in that recording had real faults,
 * so they were set so a normal rep stays quiet, and they have never been checked against known faults.
 * Distances are in shoulder widths (SW), speeds in SW per second, angles in degrees.
 */
export const PUNCH_CONFIG = {
  input: {
    /** Below this a landmark counts as not seen. */
    minVisibility: 0.5,
    /** A gap longer than this means tracking was lost, so nothing carries over it. */
    maxGapMs: 500,
    /** Landmark smoothing time constant. Higher is steadier and laggier. */
    smoothingTauMs: 30,
    /** Valid frames needed before shoulder width is trusted. */
    warmupFrames: 8,
    /** Frames in the rolling shoulder width median. */
    scaleWindowFrames: 45,
    /** Shoulders turning faster than this, in degrees a second, means the model lost the pose. */
    maxYawSpeed: 600,
    glitchHoldMs: 200,
  },

  motion: {
    /** The wrist must be this far from rest and moving this fast to start a punch. */
    startDistance: 0.22,
    startSpeed: 2,
    /** How far back the start speed may have happened. */
    recentSpeedMs: 150,
    /** The smallest and slowest movement that still counts as a punch. */
    minPeakDistance: 0.3,
    /** A straight at the camera: the wrist moves only this far, if the elbow moves this far in the picture. */
    minWristMoveWithElbow: 0.2,
    minElbowMove: 0.35,
    elbowStartMove: 0.25,
    /** While the other hand is moving, a body turn can carry this one this far without a punch. */
    minPeakDistanceOtherBusy: 0.6,
    /** How far the wrist must move relative to its own shoulder. */
    minArmMove: 0.25,
    minPeakSpeed: 2.5,
    minDurationMs: 50,
    maxDurationMs: 900,
    /** Give up on an extension that has run this long. */
    maxExtensionMs: 3000,
    /** A wrist further than this below the shoulder line is resting, not starting a punch. */
    maxStartBelowShoulder: 1,
    /** Reject movement that is mostly downward: this is the hands dropping. */
    maxDownShare: 0.5,
    /** A wrist that drops this far without moving this far forward is winding up, not punching. */
    windUpDrop: 0.25,
    windUpForward: 0.2,
    /** A wrist moving back this much with no rise or sideways travel is recoil from the other hand. */
    recoilBackShare: 0.3,
    recoilMaxRise: 0.2,
    recoilMaxAcross: 0.3,
    /** Back up within this long of leaving the chin, a low wrist was a wind-up and not resting. */
    windUpMaxMs: 900,
    /** How far below the guard a wind-up must go for a rise back to guard height to be an uppercut. */
    minUppercutDip: 1,
    /** Reject a mostly upward movement that ends where the guard was: this is the guard coming back up. */
    upwardShare: 0.55,
    raiseNearGuard: 0.35,
    /** With no guard seen yet, one that ends this close to the chest counts as the guard coming up. */
    upwardMinForward: 0.55,
    /** The peak is confirmed once the wrist falls back by this share of the distance travelled. */
    peakDropShare: 0.12,
    peakDropMin: 0.1,
    /** Or once the wrist has been this slow for this many frames at the end of the punch. */
    holdSpeed: 1,
    holdFrames: 3,
    /** Or once it peaked this long ago. */
    peakMaxAgeMs: 300,
  },

  rest: {
    /** Below this speed the hand is settled and its rest position may drift with it. */
    settleSpeed: 1,
    anchorTauMs: 400,
    /** Held still this long away from guard, the hand has a new rest position. */
    settleHoldMs: 900,
    /** A hand this close to where it started has returned. */
    returnDistance: 0.5,
    /** After a partial return, moving this far out again starts a new punch. */
    restartDistance: 0.4,
    /** Rising this directly out of a dip starts a new punch, for an uppercut's wind-up. */
    riseShare: 0.7,
  },

  guard: {
    /** A wrist this far from the nose can still be guarding the head. */
    radius: 1.15,
    /** A wrist further than this below the chin leaves the chin exposed. */
    belowChinMargin: 0.6,
    /** Chin height below the mouth. */
    chinBelowMouth: 0.08,
  },

  classify: {
    /** Straight is the default. A hook or uppercut has to reach this much evidence to win. */
    minArcEvidence: 0.5,
    straight: {
      /** Seeing this much reach and elbow extension is firm evidence of a straight. */
      reachMin: 0.68,
      reachFull: 0.88,
      elbowMin: 115,
      elbowFull: 145,
      /** The score for a fast punch with no arc evidence, when the extension can't be seen. */
      defaultScore: 0.7,
      /** A hand moving this much outward isn't extending at all. */
      outwardShareMin: 0.4,
      outwardShareFull: 0.75,
      /** Starting this far below the shoulder, a big rise isn't a straight. */
      lowStartMin: 0.4,
      lowStartFull: 0.7,
      /** At least this much of the movement seen going forward means depth is being read. */
      readableForwardShare: 0.5,
    },
    hook: {
      /** Sideways travel relative to the punching shoulder, so hip rotation doesn't count. */
      acrossMin: 0.2,
      acrossFull: 0.45,
      acrossShareMin: 0.35,
      acrossShareFull: 0.65,
      /** A tight guard opens to about 90 on a hook. Opening further than that is a straight. */
      elbowOpensFrom: 45,
      elbowOpensFully: 65,
      /** The elbow stays near 90: never opening past these on the way, nor closed at the peak. */
      elbowBent: 110,
      elbowOpen: 135,
      elbowClosed: 30,
      elbowNinety: 50,
      /** Degrees from level at the peak. */
      upperArmLevel: 40,
      upperArmDropped: 60,
      forearmLevel: 35,
      forearmTilted: 55,
    },
    uppercut: {
      /** How far below its own shoulder the wrist has to start. */
      startBelowMin: 0.3,
      startBelowFull: 0.5,
      /** An uppercut stays about as bent as it started. Opening this much is a straight. */
      elbowOpensFrom: 25,
      elbowOpensFully: 45,
      elbowBent: 125,
      elbowOpen: 150,
      /** Degrees from straight up at the peak. */
      forearmVertical: 35,
      forearmTilted: 55,
      /** How far up the wrist must travel, so a front-on straight doesn't look like an uppercut. */
      riseMin: 0.45,
      riseFull: 0.75,
      upShareMin: 0.35,
      upShareFull: 0.65,
    },
    /** Below this a punch is reported as "punch", not guessed at. */
    minConfidence: 0.45,
  },

  form: {
    /** The other hand this far below its own shoulder at the peak of a punch has left the guard. */
    otherHandBelowShoulder: 0.12,
    /** How long a hand gets to come back, one beat. */
    returnWindowMs: 700,
    /** A hand must stay below the chin this long between punches to be flagged. */
    handsLowHoldMs: 500,
    /** Only nag about low hands within this long of the last punch. */
    activeWindowMs: 5000,
    handsLowCooldownMs: 3000,
    /**
     * Straights are flagged only when both the elbow angle and the reach fall short of these. Low,
     * because the model reads real full jabs at about 105 to 120 degrees from the front.
     */
    fullExtensionElbow: 95,
    fullExtensionReach: 0.75,
    /**
     * Hook elbow limits relative to the shoulder of that arm. High, because the model puts a normal
     * hook's elbow about 0.3 to 0.5 above the shoulder.
     */
    flareOutward: 0.7,
    flareAboveShoulder: 0.6,
    /** A cross with less rotation than both of these is flagged. */
    minShoulderRotation: 12,
    minHipRotation: 6,
  },

  combo: {
    /** Punches closer together than this belong to one combo. */
    gapMs: 1200,
  },

  cues: {
    /** How long a cue stays up, and how soon the same one may repeat. */
    holdMs: 1600,
    repeatMs: 4000,
  },

  framing: {
    minVisibility: 0.5,
    /** Key joints must sit at least this far inside the image. */
    edgeMargin: 0.01,
    /** Shoulder width as a share of image width. */
    tooCloseWidth: 0.42,
    tooFarWidth: 0.09,
    /** Mean brightness out of 255 below which the picture is too dark. */
    darkLuma: 40,
    /** A problem must last this long before it is shown, and clear for this long to go away. */
    showAfterMs: 700,
    clearAfterMs: 400,
  },
} as const;

export type PunchConfig = typeof PUNCH_CONFIG;
