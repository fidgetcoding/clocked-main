/**
 * Every tunable number for punch detection, in one place.
 *
 * THESE ARE GUESSES. They were set from boxing biomechanics and synthetic motion, not from a
 * labelled set of real punches. Expect to change them after watching real people use this.
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
  },

  motion: {
    /** The wrist must be this far from rest and moving this fast to start a punch. */
    startDistance: 0.3,
    startSpeed: 2,
    /** The smallest and slowest movement that still counts as a punch. */
    minPeakDistance: 0.45,
    /** How far the wrist must move relative to its own shoulder. */
    minArmMove: 0.35,
    minPeakSpeed: 2.5,
    minDurationMs: 50,
    maxDurationMs: 900,
    /** A wrist further than this below the shoulder line is resting, not starting a punch. */
    maxStartBelowShoulder: 1,
    /** Reject movement that is mostly downward: this is the hands dropping. */
    maxDownShare: 0.5,
    /** Reject a mostly upward movement that ends this close to the chest: this is the guard coming up. */
    upwardShare: 0.55,
    upwardMinForward: 0.55,
    /** The peak is confirmed once the wrist falls back by this share of the distance travelled. */
    peakDropShare: 0.12,
    peakDropMin: 0.1,
    /** Or once the wrist has been this slow for this many frames at the end of the punch. */
    holdSpeed: 1,
    holdFrames: 2,
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
    straight: {
      reachMin: 0.68,
      reachFull: 0.88,
      elbowMin: 115,
      elbowFull: 145,
      /** The score for a punch with no arc at all, when the arm's extension can't be seen. */
      byEliminationScore: 0.6,
      outwardShareMin: 0.3,
      outwardShareFull: 0.6,
      /** At least this much of the movement seen going forward means depth is being read. */
      readableForwardShare: 0.5,
    },
    hook: {
      acrossShareMin: 0.3,
      acrossShareFull: 0.6,
      elbowBent: 115,
      elbowOpen: 150,
    },
    uppercut: {
      upShareMin: 0.35,
      upShareFull: 0.65,
      /** How far up the wrist must travel, so a front-on straight doesn't look like an uppercut. */
      riseMin: 0.45,
      riseFull: 0.75,
      elbowBent: 125,
      elbowOpen: 160,
    },
    /** Below this a punch is reported as "punch", not guessed at. */
    minConfidence: 0.45,
  },

  form: {
    /** The other hand moving this far during a punch has left the guard. */
    otherHandDistance: 0.6,
    otherHandForwardShare: 0.5,
    /** How long a hand gets to come back, one beat. */
    returnWindowMs: 700,
    /** A hand must stay below the chin this long between punches to be flagged. */
    handsLowHoldMs: 500,
    /** Only nag about low hands within this long of the last punch. */
    activeWindowMs: 5000,
    handsLowCooldownMs: 3000,
    /** Straights are flagged only when both the elbow angle and the reach fall short of these. */
    fullExtensionElbow: 140,
    fullExtensionReach: 0.9,
    /** Hook elbow limits relative to the shoulder of that arm. */
    flareOutward: 0.7,
    flareAboveShoulder: 0.25,
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
