import React, { useEffect, useRef, useState } from 'react';
import { X, Save, FolderOpen, Trash2, Copy, ClipboardPaste, Download, Upload } from 'lucide-react';
import { CharacterState } from '../../types/character';
import { RACES, CLASSES } from '../../constants/presets';
import {
  Slot,
  SLOT_COUNT,
  loadSlots,
  saveSlot,
  deleteSlot,
  encodeShareCode,
  decodeShareCode
} from '../../lib/persistence';
import { Bi } from './Panels';
import { sound } from '../../audio/soundManager';

/* ───────────────────────── Toast ───────────────────────── */

export const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      key={message}
      role="status"
      className="gp animate-toast-in fixed bottom-28 left-1/2 z-60 px-4 py-2 text-[12px] text-gp-hot pointer-events-none"
    >
      {message}
    </div>
  );
};

/* ───────────────────────── Modal shell ───────────────────────── */

export const ModalShell: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, wide, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in select-none"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`gp animate-rise-in w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[88vh] flex flex-col`}
      >
        <div className="gp-title flex items-center justify-between shrink-0">
          <span>{title}</span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            aria-label="Đóng"
            className="text-gp-mute hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
};

/* ───────────────────────── Quản lý ngoại hình: slots, files, share code ───────────────────────── */

interface SlotsModalProps {
  isOpen: boolean;
  characterState: CharacterState;
  getThumb: () => Promise<string>;
  onLoad: (state: CharacterState) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onNotify: (message: string) => void;
  onClose: () => void;
}

export const SlotsModal: React.FC<SlotsModalProps> = ({
  isOpen,
  characterState,
  getThumb,
  onLoad,
  onExport,
  onImportFile,
  onNotify,
  onClose
}) => {
  const [slots, setSlots] = useState<(Slot | null)[]>(() => loadSlots());
  const [codeInput, setCodeInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setSlots(loadSlots());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (i: number) => {
    sound.playTriumph();
    const thumb = await getThumb();
    if (saveSlot(i, characterState, thumb)) {
      setSlots(loadSlots());
      onNotify(`Đã lưu vào ô ${i + 1}`);
    } else {
      onNotify('Không thể lưu — bộ nhớ trình duyệt đã đầy hoặc không khả dụng');
    }
  };

  const handleDelete = (i: number) => {
    sound.playClick();
    deleteSlot(i);
    setSlots(loadSlots());
    onNotify(`Đã xóa ô ${i + 1}`);
  };

  const handleCopy = async () => {
    sound.playClick();
    const code = encodeShareCode(characterState);
    try {
      await navigator.clipboard.writeText(code);
      onNotify('Đã sao chép mã nhân vật');
    } catch {
      onNotify('Không dùng được clipboard — hãy sao chép mã từ ô bên dưới');
      setCodeInput(code);
    }
  };

  const handleImportCode = () => {
    const state = decodeShareCode(codeInput);
    if (!state) {
      onNotify('Mã nhân vật không hợp lệ');
      return;
    }
    sound.playTriumph();
    onLoad(state);
    setCodeInput('');
    onNotify(`Đã nạp "${state.name}" từ mã`);
    onClose();
  };

  return (
    <ModalShell title={<Bi ko="Quản lý ngoại hình" en="Quản lý ngoại hình" />} onClose={onClose} wide>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const s = slots[i];
          return (
            <div key={i} className="border border-gp-line bg-black/30 p-1.5 flex min-w-0 h-full flex-col">
              <div className="flex min-h-[16px] items-center justify-between gap-1 text-[10px] text-gp-mute mb-1">
                <span className="shrink-0">Ô lưu {i + 1}</span>
                {s && <span className="min-w-0 truncate">{new Date(s.savedAt).toLocaleDateString()}</span>}
              </div>
              <div className="aspect-3/4 bg-black border border-gp-line overflow-hidden flex items-center justify-center mb-1.5">
                {s?.thumb ? (
                  <img src={s.thumb} alt={`Slot ${i + 1} preview`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gp-mute">{s ? 'Không có ảnh xem trước' : 'Trống'}</span>
                )}
              </div>
              <div className="text-[10px] leading-tight mb-1.5 min-h-[26px]">
                {s && (
                  <>
                    <div className="text-white truncate">{s.state.name || 'Chưa đặt tên'}</div>
                    <div className="text-gp-mute truncate">
                      {RACES[s.state.race]?.name} · {CLASSES[s.state.characterClass]?.name}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-auto flex gap-1">
                <button className="gp-btn flex-1 px-0! flex items-center justify-center" title="Lưu vào đây" aria-label={`Save slot ${i + 1}`} onClick={() => handleSave(i)}>
                  <Save size={12} />
                </button>
                <button
                  className="gp-btn flex-1 px-0! flex items-center justify-center"
                  disabled={!s}
                  title="Nạp"
                  aria-label={`Load slot ${i + 1}`}
                  onClick={() => {
                    if (!s) return;
                    sound.playTriumph();
                    onLoad(s.state);
                    onNotify(`Đã nạp ô ${i + 1}`);
                    onClose();
                  }}
                >
                  <FolderOpen size={12} />
                </button>
                <button className="gp-btn flex-1 px-0! flex items-center justify-center" disabled={!s} title="Xóa" aria-label={`Clear slot ${i + 1}`} onClick={() => handleDelete(i)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.bns"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) {
              onImportFile(f);
              onClose();
            }
          }}
        />
        <button
          className="gp-btn flex items-center gap-1.5"
          onClick={() => {
            sound.playClick();
            onExport();
          }}
        >
          <Download size={12} /> Lưu ra tệp <span className="text-[10px] text-gp-mute">Export</span>
        </button>
        <button
          className="gp-btn flex items-center gap-1.5"
          onClick={() => {
            sound.playClick();
            fileRef.current?.click();
          }}
        >
          <Upload size={12} /> Nạp từ tệp <span className="text-[10px] text-gp-mute">Import</span>
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-gp-line">
        <div className="text-[11px] text-gp-mute mb-1">
          <Bi ko="Mã nhân vật" en="Mã nhân vật — sao chép để chia sẻ, dán để nạp" />
        </div>
        <textarea
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="BNS1:…"
          rows={3}
          spellCheck={false}
          className="gp-input w-full font-mono text-[11px] resize-none select-text"
        />
        <div className="mt-1.5 flex justify-end gap-1.5">
          <button className="gp-btn flex items-center gap-1.5" onClick={handleCopy}>
            <Copy size={12} /> Sao chép mã của tôi
          </button>
          <button className="gp-btn flex items-center gap-1.5" disabled={!codeInput.trim()} onClick={handleImportCode}>
            <ClipboardPaste size={12} /> Nạp mã
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

/* ───────────────────────── Keyboard shortcuts ───────────────────────── */

const SHORTCUTS: [string, string][] = [
  ['Ctrl / ⌘ + Z', 'Hoàn tác'],
  ['Ctrl / ⌘ + Shift + Z  or  Y', 'Làm lại'],
  ['R', 'Ngẫu nhiên hóa ngoại hình'],
  ['T', 'Bật/tắt xoay nhân vật'],
  ['S', 'Quản lý ngoại hình'],
  ['P', 'Chụp ảnh'],
  ['1 – 5', 'Camera: mặt / nửa trên / eo / toàn thân / chân'],
  ['← / →', 'Bước trước / bước sau'],
  ['?', 'Hiện trợ giúp này'],
  ['Esc', 'Đóng hộp thoại']
];

const Credits: React.FC = () => {
  const [credits, setCredits] = React.useState<Record<string, string[]> | null>(null);
  React.useEffect(() => {
    let alive = true;
    fetch('/models/credits.json')
      .then((r) => r.json())
      .then((c) => alive && setCredits(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="mt-3 pt-2 border-t border-gp-line">
      <div className="text-gp-hot text-[11px] mb-1">Ghi công tài nguyên</div>
      <p className="text-[10px] text-gp-mute leading-snug">
        Thân người, da, mắt, tóc và trang phục gốc: MakeHuman Community / MPFB (CC0). Các tài sản bổ sung theo giấy phép CC-BY của:
      </p>
      <p className="mt-1 text-[10px] text-gp-text leading-snug">
        {credits ? Object.keys(credits).join(', ') : '…'}
      </p>
    </div>
  );
};

export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <ModalShell title={<Bi ko="Phím tắt" en="Phím tắt" />} onClose={onClose}>
      <ul>
        {SHORTCUTS.map(([keys, label]) => (
          <li key={keys} className="flex items-center justify-between gap-4 py-1.5 border-b border-gp-line/50 last:border-0">
            <span className="text-gp-text">{label}</span>
            <kbd className="px-1.5 py-0.5 bg-black border border-gp-line text-gp-hot text-[10px] font-mono whitespace-nowrap">{keys}</kbd>
          </li>
        ))}
      </ul>
      <Credits />
    </ModalShell>
  );
};
