import { EncodingPrimer } from "@/components/encoding-primer";
import { MainMenuButton } from "@/components/main-menu-button";

// Reference sheet for binary, hex, and ASCII. Open to everyone, no sign-in.
export default function BenchPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">REFERENCE</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Encoding bench
          </h1>
        </div>
        <MainMenuButton />
      </header>
      <EncodingPrimer />
    </div>
  );
}
