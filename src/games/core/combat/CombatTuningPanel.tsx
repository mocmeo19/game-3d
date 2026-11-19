import { COMBAT_TUNING_FIELDS, type CombatTuning, type CombatTuningGroup } from './combatSettings';

interface Props {
  group: CombatTuningGroup;
  title: string;
  description: string;
  tuning: CombatTuning;
  onChange: (tuning: CombatTuning) => void;
}

const fieldClass = 'w-full min-w-0 rounded-lg border border-white/15 bg-[#142c35] px-2 py-1.5 text-xs text-white focus:border-sky-300 focus:outline-hidden';

/** One group of the combat tuning values (the additive layers over the clips, or the third-person camera). */
export function CombatTuningPanel({ group, title, description, tuning, onChange }: Props) {
  const headingId = `combat-tuning-${group}`;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <h3 id={headingId} className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{description}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {COMBAT_TUNING_FIELDS.filter((field) => field.group === group).map((field) => <label key={field.key} className="flex flex-col gap-1 text-[11px] text-white/65">
          {field.label} ({field.unit})
          <input type="number" className={fieldClass} min={field.min} max={field.max} step={field.step} value={tuning[field.key]}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (event.target.value.trim() === '' || !Number.isFinite(value)) return;
              onChange({ ...tuning, [field.key]: value });
            }} />
        </label>)}
      </div>
    </section>
  );
}
