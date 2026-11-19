import { RotateCcw } from 'lucide-react';
import type { AutoSaveStatus } from '../../../../settings/useAutoSavedSettings';

interface SettingsTabFooterProps {
  status: AutoSaveStatus;
  savedMessage: string;
  onReset?: () => void;
}

/** Save progress of the open tab, and its "back to defaults" button. */
export function SettingsTabFooter({ status, savedMessage, onReset }: SettingsTabFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p role={status === 'error' ? 'alert' : 'status'} className={`text-xs ${status === 'error' ? 'text-red-300' : 'text-white/45'}`}>
        {status === 'saving' && 'Đang lưu…'}
        {status === 'saved' && savedMessage}
        {status === 'error' && 'Không lưu được cài đặt trên trình duyệt này. Hãy thử lại.'}
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-sm border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ffd34d]"
        >
          <RotateCcw size={13} /> Khôi phục mặc định
        </button>
      )}
    </div>
  );
}
