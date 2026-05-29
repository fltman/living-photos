import { useEffect, useState } from "react";

const STEPS = [
  "Läser av bilden",
  "Identifierar personen",
  "Tolkar scenen",
  "Skapar persona",
];

/** Staged, animated progress shown while Opus identifies the marked person.
 * The call has no real progress events, so steps advance on a timer to give
 * a sense of motion; the last step keeps spinning until the result arrives. */
export function IdentifyProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center gap-2 text-sm text-white/80">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-400" />
        </span>
        Claude Opus analyserar bilden
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="indeterminate-bar h-full w-1/3 rounded-full bg-yellow-400" />
      </div>

      <ul className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              <span className="flex h-5 w-5 items-center justify-center">
                {done ? (
                  <span className="text-yellow-400">✓</span>
                ) : active ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
                )}
              </span>
              <span
                className={
                  done
                    ? "text-white/50"
                    : active
                      ? "text-white"
                      : "text-white/35"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
