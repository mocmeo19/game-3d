import { GameSettingsPreview } from './GameSettingsPreview';
import { useState } from 'react';
import { GameSettingsPanel } from '../game/testlab/GameSettingsPanel';
import { loadGameSettings, saveGameSettings } from '../game/testlab/gameSettings';

export function GameSettingsSection() {
  const [settings, setSettings] = useState(loadGameSettings);
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-sky-300/15 bg-sky-300/5 p-3 text-xs leading-relaxed text-sky-100/75">
        Thông số bên dưới áp dụng cho Test Nhân Vật. Cấu hình Hiển thị & hiệu năng và Âm thanh áp dụng cho tất cả game.
      </p>
      <GameSettingsPanel settings={settings} inGame={false} renderPreview={(draft) => <GameSettingsPreview settings={draft} />} onSave={async (value) => setSettings(await saveGameSettings(value))} />
    </div>
  );
}
