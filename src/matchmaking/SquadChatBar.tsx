import { MessageSquareText } from 'lucide-react';

interface SquadChatBarProps {
  /** The latest system line about the search. */
  message: string;
}

/** The squad channel along the bottom of the lobby, carrying the search's status lines. */
export function SquadChatBar({ message }: SquadChatBarProps) {
  return (
    <div className="flex h-10 w-[min(560px,calc(100vw-32px))] items-center gap-3 rounded-sm border border-white/12 bg-black/55 px-3 backdrop-blur-sm">
      <MessageSquareText size={16} className="shrink-0 text-white/60" aria-hidden />
      <span className="shrink-0 text-[12px] font-bold text-white/85">Đội</span>
      <p role="status" aria-live="polite" className="min-w-0 truncate text-[12px] text-white/75">
        <span className="text-[#ffd34d]">[Hệ thống]</span> {message}
      </p>
    </div>
  );
}
