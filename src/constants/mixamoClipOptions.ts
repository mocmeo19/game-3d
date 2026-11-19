import type { SelectOption } from '../components/UI/select/selectModel';

interface ClipLike {
  file: string | null;
  label: string;
  ctx: string | null;
}

const GROUPS: { ctx: string | null; label: string }[] = [
  { ctx: 'rifle', label: 'Cầm súng' },
  { ctx: 'pistol', label: 'Cầm súng lục' },
  { ctx: 'knife', label: 'Cầm dao' },
  { ctx: 'sword', label: 'Cầm kiếm' },
  { ctx: null, label: 'Tay không' },
  { ctx: 'dance', label: 'Nhảy múa' },
];

/** The animation library as Select options: grouped by what the hands hold, sorted by name, the file shown as a hint. */
export function clipOptions(clips: ClipLike[]): SelectOption[] {
  const options: SelectOption[] = [];
  for (const group of GROUPS) {
    clips
      .filter((clip): clip is ClipLike & { file: string } => !!clip.file && (clip.ctx ?? null) === group.ctx)
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
      .forEach((clip) => options.push({ value: clip.file, label: clip.label, hint: clip.file, group: group.label }));
  }
  return options;
}
