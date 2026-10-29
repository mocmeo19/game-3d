import { useEffect, useRef } from 'react';
import { ChevronDown, LogOut, MousePointer2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { GameSnapshot } from './GameEngine';

interface PauseMenuProps {
  state: GameSnapshot;
  sensitivity: number;
  muted: boolean;
  touch: boolean;
  controls: [string, string][];
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  onSensitivity: (value: number) => void;
  onToggleMute: () => void;
}

export function PauseMenu({ state, sensitivity, muted, touch, controls, onResume, onRestart, onExit, onSensitivity, onToggleMute }: PauseMenuProps) {
  const dialog = useRef<HTMLElement>(null);
  const resume = useRef<HTMLButtonElement>(null);
  const me = state.rows.find((row) => row.me);

  useEffect(() => {
    const previous = document.activeElement;
    resume.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <div className="arena-overlay pause-overlay">
      <section
        ref={dialog}
        className="pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        aria-describedby="pause-description"
        onKeyDown={(event) => {
          // Keep keyboard navigation inside the pause menu, away from the game HUD.
          if (event.key !== 'Tab') return;
          const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, summary') ?? [])
            .filter((element) => element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
      >
        <header className="pause-header">
          <span className="pause-status"><Pause size={12} fill="currentColor" /> TRẬN ĐẤU ĐÃ TẠM DỪNG</span>
          <span className="pause-round">VÒNG {state.round}</span>
        </header>
        <div className="pause-body">
          <div className="pause-main">
            <h1 id="pause-title">Nghỉ một nhịp.</h1>
            <p id="pause-description">Trận đấu đang chờ bạn. Sẵn sàng thì trở lại thôi.</p>
            <div className="pause-score" aria-label={`Tỷ số CT ${state.score.CT}, T ${state.score.T}`}>
              <div className="pause-team ct"><span>ĐỘI CT</span><strong>{state.score.CT}</strong></div>
              <span className="pause-score-divider">:</span>
              <div className="pause-team t"><span>ĐỘI T</span><strong>{state.score.T}</strong></div>
            </div>
            <dl className="pause-stats">
              <div><dt>Hạ gục</dt><dd>{me?.kills ?? 0}</dd></div>
              <div><dt>Hỗ trợ</dt><dd>{me?.assists ?? 0}</dd></div>
              <div><dt>Bị hạ</dt><dd>{me?.deaths ?? 0}</dd></div>
            </dl>
            <button ref={resume} className="pause-resume" disabled={!state.loaded} onClick={onResume}>
              <Play size={18} fill="currentColor" /> Tiếp tục trận đấu
            </button>
            <span className="pause-resume-hint">{touch ? 'Chạm để trở lại trận đấu' : 'Nhấn Enter hoặc bấm nút để tiếp tục'}</span>
            <button type="button" className="pause-restart" onClick={onRestart}>
              <RotateCcw size={16} /> Chơi lại trận đấu
            </button>
            <button type="button" className="pause-exit" onClick={onExit}>
              <LogOut size={16} /> <span>Thoát trận đấu<small>Về màn hình home</small></span>
            </button>
          </div>
          <aside className="pause-settings" aria-label="Cài đặt nhanh">
            <h2>Cài đặt nhanh</h2>
            <div className="pause-audio">
              <div><Volume2 size={17} /><span>Âm thanh<small>{muted ? 'Đang tắt' : 'Đang bật'}</small></span></div>
              <button type="button" role="switch" aria-checked={!muted} aria-label="Âm thanh trò chơi" onClick={onToggleMute}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} {muted ? 'Tắt' : 'Bật'}
              </button>
            </div>
            {!touch && <div className="pause-sensitivity">
              <label htmlFor="pause-sensitivity"><span><MousePointer2 size={16} /> Độ nhạy chuột</span><output>{sensitivity.toFixed(2)}</output></label>
              <input id="pause-sensitivity" type="range" min={0.3} max={3} step={0.05} value={sensitivity} onChange={(event) => onSensitivity(Number(event.target.value))} />
              <div className="pause-range-labels"><span>Chậm</span><span>Nhanh</span></div>
              <button className="pause-reset" onClick={() => onSensitivity(1)} disabled={sensitivity === 1}><RotateCcw size={12} /> Về mặc định</button>
            </div>}
            <div className="pause-tip"><strong>Mẹo giao tranh</strong><p>Dừng di chuyển trước khi bắn để giữ tâm ngắm chính xác hơn.</p></div>
          </aside>
        </div>
        {!touch && <details className="pause-controls">
          <summary>Phím điều khiển <ChevronDown size={16} /></summary>
          <dl>{controls.map(([key, label]) => <div key={key}><dt>{key}</dt><dd>{label}</dd></div>)}</dl>
        </details>}
      </section>
    </div>
  );
}
