import type { VoiceManifest } from './coachVoice';

/** Audio that ffmpeg is asked to read. Phone voice memos are .m4a. */
export const RECORDING_TYPES = ['m4a', 'wav', 'mp3', 'aac', 'caf', 'aif', 'aiff', 'flac', 'ogg', 'opus', 'webm', 'mp4'];

export interface MatchedRecording {
  id: string;
  /** 1 for `<id>`, 2 for `<id>-2` and so on. */
  take: number;
}

/**
 * Which line a recording is, from its file name: `punch-jab.m4a` is take 1, `punch-jab-2.m4a` take 2.
 * Case, spaces and underscores are forgiven, since phones name files their own way.
 */
export function matchRecording(fileName: string, ids: ReadonlySet<string>): MatchedRecording | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || !RECORDING_TYPES.includes(fileName.slice(dot + 1).toLowerCase())) return null;
  const name = fileName
    .slice(0, dot)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-');
  if (ids.has(name)) return { id: name, take: 1 };
  const numbered = /^(.+)-(\d+)$/.exec(name);
  if (numbered && ids.has(numbered[1]) && Number(numbered[2]) >= 1) return { id: numbered[1], take: Number(numbered[2]) };
  return null;
}

export const clipFileName = ({ id, take }: MatchedRecording) => `${id}${take > 1 ? `-${take}` : ''}.m4a`;

/** The manifest for the clips in the coach folder. Files that aren't a known line are left out. */
export function buildManifest(files: string[], ids: ReadonlySet<string>): VoiceManifest {
  const clips: Record<string, { file: string; take: number }[]> = {};
  for (const file of files) {
    if (!file.endsWith('.m4a')) continue;
    const match = matchRecording(file, ids);
    if (!match || clipFileName(match) !== file) continue;
    (clips[match.id] ??= []).push({ file, take: match.take });
  }
  return {
    version: 1,
    clips: Object.fromEntries(
      Object.keys(clips)
        .sort()
        .map((id) => [id, clips[id].sort((a, b) => a.take - b.take).map((clip) => clip.file)]),
    ),
  };
}
