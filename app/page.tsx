"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { CustomizePanel } from "@/components/customize-panel";
import { Hero } from "@/components/hero";
import { MetaBallScene } from "@/components/meta-ball-scene";
import { Navbar } from "@/components/navbar";
import { NoiseOverlay } from "@/components/noise-overlay";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import type { MetaBallSettingKey, MetaBallSettings } from "@/lib/metaball-settings";

export default function HomePage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [settings, setSettings] = useState<MetaBallSettings>(DEFAULT_SETTINGS);

  const handleChange = useCallback(
    <K extends MetaBallSettingKey>(key: K, value: MetaBallSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <main className="relative h-svh w-full overflow-hidden">
      <Image
        src="/assets/background.jpg"
        alt=""
        fill
        priority
        className="background-image z-0 object-cover object-center"
        sizes="100vw"
      />

      {/* Slogan sits beneath the metaballs so the glass reads over the type. */}
      <Hero />
      <NoiseOverlay />
      <MetaBallScene settings={settings} />

      <Navbar
        panelOpen={panelOpen}
        onOpenPanel={() => setPanelOpen((open) => !open)}
      />

      <CustomizePanel
        open={panelOpen}
        settings={settings}
        onClose={() => setPanelOpen(false)}
        onChange={handleChange}
      />
    </main>
  );
}
