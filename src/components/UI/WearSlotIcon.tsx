import type { SlotId } from '../../constants/equipment';
import { resolveWearSlotIcon } from './wearSlotIcons';

const ICON_SIZE_PX = 18;

export function WearSlotIcon({ slot }: { slot: SlotId }) {
  const source = resolveWearSlotIcon(slot);
  if (source.kind === 'lucide') {
    const Icon = source.icon;
    return <Icon size={ICON_SIZE_PX} strokeWidth={1.75} aria-hidden="true" />;
  }
  return (
    <svg
      width={ICON_SIZE_PX}
      height={ICON_SIZE_PX}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {source.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
