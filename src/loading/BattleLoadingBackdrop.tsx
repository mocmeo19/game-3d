export function BattleLoadingBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <img
        src="/loading/battle-royale-dusk.jpg"
        alt=""
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover object-[65%_center] sm:object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,13,0.2)_0%,rgba(5,8,13,0.5)_48%,rgba(5,8,13,0.9)_100%)]" />
    </div>
  );
}
