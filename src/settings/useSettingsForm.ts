import { useState, type FormEvent } from 'react';

export function useSettingsForm<T>(load: () => T, save: (value: T) => Promise<T>, defaults: T) {
  const [saved, setSaved] = useState(load);
  const [draft, setDraft] = useState(saved);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (value: T) => { setDraft(value); setMessage(''); setError(''); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await save(draft);
      setSaved(result);
      setDraft((latest) => latest === draft ? result : latest);
      setMessage('Đã lưu. Cấu hình sẽ được dùng khi mở nhân vật hoặc game.');
      setError('');
    } catch { setError('Không lưu được cấu hình trên trình duyệt này. Hãy thử lại.'); setMessage(''); }
    finally { setSaving(false); }
  };
  return {
    draft, update, submit, message, error, saving,
    dirty: JSON.stringify(saved) !== JSON.stringify(draft),
    reset: () => update(structuredClone(defaults)),
  };
}
