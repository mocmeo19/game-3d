import { Check, Save, Swords } from 'lucide-react';
import { CharacterState } from '../../types/character';
import { WEAPON_KINDS } from '../../constants/weaponKinds';
import { WeaponKindGrid } from './WeaponKindGrid';
import { weaponModelIcon } from '../../constants/weaponModels';
import { FIREARM_MODELS, weaponStyleOf, weaponStyles } from '../../constants/weaponStyles';
import { sound } from '../../audio/soundManager';

interface WeaponPickerProps {
  state: CharacterState;
  onChange: (state: CharacterState) => void;
  onPreview: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export function WeaponPicker({ state, onChange, onPreview, onSave, saving }: WeaponPickerProps) {
  const choices = weaponStyles(state.weapon);
  const selected = weaponStyleOf(state.weapon, state.weaponStyle);
  const groups = [
    { id: 'forms', label: 'Kiểu dáng', items: choices.filter((item) => !item.model) },
    { id: 'guns', label: 'Súng', items: choices.filter((item) => item.model && FIREARM_MODELS.has(item.model)) },
    {
      id: 'models', label: 'Mẫu 3D & vật dụng',
      items: choices.filter((item) => item.model && !FIREARM_MODELS.has(item.model))
    }
  ];

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => { void onSave(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-100 border border-amber-300/60 bg-amber-300/10 hover:bg-amber-300/20 disabled:opacity-50 disabled:cursor-wait"
        >
          <Save size={14} /> {saving ? 'Đang lưu…' : 'Lưu vũ khí'}
        </button>
      </div>
      <section className="mb-4" aria-label="Loại vũ khí">
        <h3 className="text-xs text-white/60 mb-2">Loại vũ khí</h3>
        <WeaponKindGrid selected={state.weapon} onSelect={(weapon) => onChange({ ...state, weapon, weaponStyle: undefined })} />
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">{WEAPON_KINDS[state.weapon].description}</p>
      </section>
      {groups.map((group) => group.items.length > 0 && (
        <section key={group.id} className="mb-4" aria-label={group.label}>
          <h3 className="text-xs text-white/60 mb-2">{group.label}</h3>
          <div className="grid grid-cols-2 gap-2">
            {group.items.map((item) => {
              const active = selected.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    sound.playBladeWhoosh();
                    onChange({ ...state, weaponStyle: item.id });
                  }}
                  className={`relative flex flex-col p-2.5 rounded-lg border text-left transition-colors ${active ? 'border-amber-300 bg-amber-300/10' : 'border-white/15 bg-black/25 hover:border-white/40'}`}
                >
                  <span className="w-full h-20 rounded-sm bg-black/25 flex items-center justify-center mb-2">
                    {item.model ? (
                      <img src={weaponModelIcon(item.model)} alt="" loading="lazy" draggable={false} className="w-full h-full object-contain" />
                    ) : (
                      <Swords size={32} style={{ color: item.metal, filter: `drop-shadow(0 0 5px ${item.glow})` }} />
                    )}
                  </span>
                  {active && <Check size={15} className="absolute top-2 right-2 text-amber-200" aria-hidden="true" />}
                  <span className={`text-xs font-medium ${active ? 'text-amber-200' : 'text-white'}`}>{item.name}</span>
                  <span className="mt-1 text-[10px] leading-relaxed text-white/55">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <div className="border-t border-white/15 pt-3">
        <p className="text-xs text-amber-200 mb-2" aria-live="polite">Đang chọn: {selected.name}</p>
        <button type="button" onClick={() => { sound.playCue('pose'); onPreview(); }} className="gp-btn px-3! py-1.5! text-xs">
          Xem tư thế cầm vũ khí
        </button>
      </div>
    </>
  );
}
