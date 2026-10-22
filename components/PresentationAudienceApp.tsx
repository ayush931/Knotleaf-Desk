"use client";
import dynamic from "next/dynamic";
const Audience = dynamic(
  () =>
    import("./PresentationAudience").then(
      (module) => module.PresentationAudience,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="flex h-screen items-center justify-center text-sm text-neutral-400">
        Opening audience view…
      </p>
    ),
  },
);
export function PresentationAudienceApp() {
  return <Audience />;
}
