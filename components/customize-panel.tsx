"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MetaBallSettingKey, MetaBallSettings } from "@/lib/metaball-settings";

type CustomizePanelProps = {
  open: boolean;
  settings: MetaBallSettings;
  onClose: () => void;
  onChange: <K extends MetaBallSettingKey>(
    key: K,
    value: MetaBallSettings[K],
  ) => void;
};

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: SliderControlProps) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="panel-range"
        />
        <span className="value-display">{format(value)}</span>
      </div>
    </div>
  );
}

type ToggleControlProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleControl({ label, checked, onChange }: ToggleControlProps) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <label className="toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track" />
      </label>
    </div>
  );
}

const panelSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 36,
  mass: 0.85,
};

const overlayFade = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

export function CustomizePanel({
  open,
  settings,
  onClose,
  onChange,
}: CustomizePanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="panel-overlay"
            aria-label="Close customize panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayFade}
            onClick={onClose}
          />

          <motion.aside
            className="customize-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Customize metaballs"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={panelSpring}
          >
            <div className="panel-header">
              <h2 className="panel-title">Customize</h2>
              <button
                type="button"
                className="panel-close icon-btn"
                aria-label="Close panel"
                onClick={onClose}
              >
                ✕
              </button>
            </div>

            <div className="panel-body">
              <div className="section">
                <p className="section-title">Appearance</p>

                <div className="control-row">
                  <span className="control-label">Color</span>
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) => onChange("color", e.target.value)}
                    className="color-input"
                    aria-label="Ball color"
                  />
                </div>

                <SliderControl
                  label="Frost (blur)"
                  value={settings.frost}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => onChange("frost", v)}
                />

                <SliderControl
                  label="Refraction"
                  value={settings.refraction}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => onChange("refraction", v)}
                />
              </div>

              <div className="divider" />

              <div className="section">
                <p className="section-title">Motion</p>

                <SliderControl
                  label="Ball count"
                  value={settings.ballCount}
                  min={2}
                  max={50}
                  step={1}
                  onChange={(v) => onChange("ballCount", Math.round(v))}
                  format={(v) => String(Math.round(v))}
                />

                <SliderControl
                  label="Speed"
                  value={settings.speed}
                  min={0.05}
                  max={1.2}
                  step={0.01}
                  onChange={(v) => onChange("speed", v)}
                />

                <SliderControl
                  label="Size"
                  value={settings.animationSize}
                  min={10}
                  max={60}
                  step={1}
                  onChange={(v) => onChange("animationSize", v)}
                  format={(v) => String(Math.round(v))}
                />

                <SliderControl
                  label="Clump factor"
                  value={settings.clumpFactor}
                  min={0.2}
                  max={2}
                  step={0.05}
                  onChange={(v) => onChange("clumpFactor", v)}
                />
              </div>

              <div className="divider" />

              <div className="section">
                <p className="section-title">Cursor</p>

                <ToggleControl
                  label="Follow cursor"
                  checked={settings.enableMouseInteraction}
                  onChange={(v) => onChange("enableMouseInteraction", v)}
                />

                <SliderControl
                  label="Cursor smoothing"
                  value={settings.hoverSmoothness}
                  min={0.001}
                  max={0.25}
                  step={0.001}
                  onChange={(v) => onChange("hoverSmoothness", v)}
                />

                <SliderControl
                  label="Cursor size"
                  value={settings.cursorBallSize}
                  min={1}
                  max={8}
                  step={0.1}
                  onChange={(v) => onChange("cursorBallSize", v)}
                />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
