"use client";

import Image from "next/image";

type NavbarProps = {
  onOpenPanel: () => void;
  panelOpen: boolean;
};

export function Navbar({ onOpenPanel, panelOpen }: NavbarProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-10 py-5">
      <div className="pointer-events-none flex h-9 w-9 items-center justify-center">
        <Image
          src="/assets/logo.svg"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
          priority
        />
      </div>

      <button
        type="button"
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 active:scale-95"
        aria-label="Open customize panel"
        aria-expanded={panelOpen}
        onClick={onOpenPanel}
      >
        <Image
          src="/assets/menu-button.svg"
          alt=""
          width={20}
          height={17}
          className="h-[17px] w-5"
        />
      </button>
    </header>
  );
}
