import { useEffect, useState, type ReactNode } from 'react';
import { initializeConfigurations } from './configurationStore';

export function ConfigurationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    void initializeConfigurations().then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  if (ready) return children;
  return (
    <div className="grid h-dvh place-items-center bg-[#09131e] p-6 text-white">
      {error ? <div role="alert" className="max-w-md space-y-4 text-center">
        <h1 className="text-lg font-semibold">Không mở được cấu hình IndexedDB</h1>
        <p className="text-sm text-slate-400">Kiểm tra quyền lưu dữ liệu của trình duyệt và đóng các tab cũ của ứng dụng, rồi thử lại.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}
          className="rounded-lg bg-sky-300 px-5 py-2 text-sm text-slate-950">Thử lại</button>
      </div> : <p role="status">Đang nạp cấu hình…</p>}
    </div>
  );
}
