"use client";

import dynamic from "next/dynamic";
import type { MetaBallSettings } from "@/lib/metaball-settings";

const MetaBalls = dynamic(() => import("@/components/MetaBalls"), {
  ssr: false,
  loading: () => null,
});

type MetaBallSceneProps = {
  settings: MetaBallSettings;
};

export function MetaBallScene({ settings }: MetaBallSceneProps) {
  return (
    <div className="metaball-scene pointer-events-none absolute inset-0 z-20">
      <div className="liquid-glass-stack pointer-events-auto absolute inset-0">
        <MetaBalls {...settings} />
      </div>
    </div>
  );
}
