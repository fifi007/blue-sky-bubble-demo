"use client";

import Image from "next/image";

export function Hero() {
  return (
    <section
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      aria-label="Hero"
    >
      <div className="hero-slogan select-none">
        <Image
          src="/assets/slogan.svg"
          alt=""
          width={611}
          height={459}
          className="slogan-img"
          priority
        />
      </div>
    </section>
  );
}
