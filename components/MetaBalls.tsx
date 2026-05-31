"use client";

import { useEffect, useRef } from "react";
import {
  Renderer,
  Program,
  Mesh,
  Triangle,
  Transform,
  Vec3,
  Camera,
  Texture,
} from "ogl";

function parseHexColor(hex: string) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function fract(x: number) {
  return x - Math.floor(x);
}

function hash31(p: number) {
  let r = [p * 0.1031, p * 0.103, p * 0.0973].map(fract);
  const r_yzx = [r[1], r[2], r[0]];
  const dotVal =
    r[0] * (r_yzx[0] + 33.33) + r[1] * (r_yzx[1] + 33.33) + r[2] * (r_yzx[2] + 33.33);
  for (let i = 0; i < 3; i++) {
    r[i] = fract(r[i] + dotVal);
  }
  return r;
}

function hash33(v: number[]) {
  let p = [v[0] * 0.1031, v[1] * 0.103, v[2] * 0.0973].map(fract);
  const p_yxz = [p[1], p[0], p[2]];
  const dotVal =
    p[0] * (p_yxz[0] + 33.33) + p[1] * (p_yxz[1] + 33.33) + p[2] * (p_yxz[2] + 33.33);
  for (let i = 0; i < 3; i++) {
    p[i] = fract(p[i] + dotVal);
  }
  const p_xxy = [p[0], p[0], p[1]];
  const p_yxx = [p[1], p[0], p[0]];
  const p_zyx = [p[2], p[1], p[0]];
  const result: number[] = [];
  for (let i = 0; i < 3; i++) {
    result[i] = fract((p_xxy[i] + p_yxx[i]) * p_zyx[i]);
  }
  return result;
}

const vertex = `#version 300 es
precision highp float;
layout(location = 0) in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec3 iMouse;
uniform vec3 iColor;
uniform vec3 iCursorColor;
uniform float iAnimationSize;
uniform int iBallCount;
uniform float iCursorBallSize;
uniform vec3 iMetaBalls[50];
uniform float iClumpFactor;
uniform bool enableTransparency;
uniform sampler2D iSceneTex;
uniform bool iHasScene;
uniform float iRefraction;
uniform float iFrost;
out vec4 outColor;
const float PI = 3.14159265359;

float getMetaBallValue(vec2 c, float r, vec2 p) {
  vec2 d = p - c;
  float dist2 = dot(d, d);
  return (r * r) / dist2;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float scale = iAnimationSize / iResolution.y;
  vec2 coord = (fc - iResolution.xy * 0.5) * scale;
  vec2 mouseW = (iMouse.xy - iResolution.xy * 0.5) * scale;
  float m1 = 0.0;
  for (int i = 0; i < 50; i++) {
    if (i >= iBallCount) break;
    m1 += getMetaBallValue(iMetaBalls[i].xy, iMetaBalls[i].z, coord);
  }
  float m2 = getMetaBallValue(mouseW, iCursorBallSize, coord);
  float total = m1 + m2;

  // Antialiased coverage of the metaball surface (original threshold logic).
  float f = smoothstep(-1.0, 1.0, (total - 1.3) / min(1.0, fwidth(total)));

  // Smooth "dome" height field used for fake 3D glass lighting + refraction.
  // Derivatives must be evaluated in uniform control flow, so compute first.
  float height = smoothstep(0.6, 3.2, total);
  vec2 grad = vec2(dFdx(height), dFdy(height));

  if (f <= 0.0015) {
    outColor = vec4(0.0);
    return;
  }

  // Steep slopes at the rim, flat facing the viewer in the body.
  vec3 normal = normalize(vec3(-grad * 1.9, 0.22));

  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 lightDir = normalize(vec3(-0.42, 0.68, 0.74));
  vec3 halfDir = normalize(lightDir + viewDir);

  float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
  float specular = pow(clamp(dot(normal, halfDir), 0.0, 1.0), 46.0);
  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.3);

  // Base translucent tint (keeps the color + cursor-color controls working).
  vec3 tint = iColor;
  if (total > 0.0) {
    tint = iColor * (m1 / total) + iCursorColor * (m2 / total);
  }

  // Top-of-dome sheen for an inner highlight band.
  float sheen = clamp(normal.y, 0.0, 1.0) * height;

  vec3 glass;
  float alpha;

  if (iHasScene) {
    // ---- Frosted glass: refract + blur the scene (background + slogan) ------
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    uv.y = 1.0 - uv.y;
    // Lens displacement: bend more strongly toward the rim of each ball.
    vec2 refr = normal.xy * iRefraction;
    // Poisson-disk multi-tap blur for the frosted look.
    const vec2 taps[12] = vec2[12](
      vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457),
      vec2(-0.203, 0.621), vec2(0.962, -0.195), vec2(0.473, -0.480),
      vec2(0.519, 0.767), vec2(0.185, -0.893), vec2(0.507, 0.064),
      vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598)
    );
    vec3 acc = texture(iSceneTex, uv + refr).rgb;
    for (int i = 0; i < 12; i++) {
      acc += texture(iSceneTex, uv + refr + taps[i] * iFrost).rgb;
    }
    vec3 sceneCol = acc / 13.0;
    // Slight cool tint + light wash so it still reads as a colored glass body.
    glass = mix(sceneCol, tint, 0.14) * (0.97 + 0.10 * diffuse);
    alpha = f;
  } else {
    glass = tint * (0.58 + 0.30 * diffuse);
    alpha = f * (0.22 + 0.52 * fresnel);
  }

  // Cool fresnel rim + inner sheen + bright specular glint on top.
  glass += vec3(0.72, 0.85, 1.0) * fresnel * 0.5;
  glass += vec3(1.0) * sheen * 0.16;
  glass += vec3(1.0) * specular * 1.4;

  alpha += (specular + sheen * 0.1) * f;
  alpha = clamp(alpha, 0.0, 1.0);

  outColor = vec4(glass, enableTransparency ? alpha : 1.0);
}
`;

export type MetaBallsProps = {
  color?: string;
  speed?: number;
  enableMouseInteraction?: boolean;
  hoverSmoothness?: number;
  animationSize?: number;
  ballCount?: number;
  clumpFactor?: number;
  cursorBallSize?: number;
  cursorBallColor?: string;
  enableTransparency?: boolean;
  /** Strength of the glass refraction (0..1). */
  refraction?: number;
  /** Amount of frosted blur applied to the refracted scene (0..1). */
  frost?: number;
  /** Image layers (drawn behind, in order) that the glass refracts/blurs. */
  sceneSrc?: string;
  sloganSrc?: string;
  sloganWidthVw?: number;
  sloganMaxWidth?: number;
  sloganAspect?: number;
};

const MetaBalls = ({
  color = "#ffffff",
  speed = 0.3,
  enableMouseInteraction = true,
  hoverSmoothness = 0.05,
  animationSize = 30,
  ballCount = 15,
  clumpFactor = 1,
  cursorBallSize = 3,
  cursorBallColor = "#ffffff",
  enableTransparency = false,
  refraction = 0.5,
  frost = 0.55,
  sceneSrc = "/assets/background.jpg",
  sloganSrc = "/assets/slogan.svg",
  sloganWidthVw = 0.3535,
  sloganMaxWidth = 611,
  sloganAspect = 459 / 611,
}: MetaBallsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dpr = 1;
    const renderer = new Renderer({ dpr, alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, enableTransparency ? 0 : 1);
    container.appendChild(gl.canvas);

    const camera = new Camera(gl, {
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
      near: 0.1,
      far: 10,
    });
    camera.position.z = 1;

    const geometry = new Triangle(gl);
    const [r1, g1, b1] = parseHexColor(color);
    const [r2, g2, b2] = parseHexColor(cursorBallColor);

    const metaBallsUniform: Vec3[] = [];
    for (let i = 0; i < 50; i++) {
      metaBallsUniform.push(new Vec3(0, 0, 0));
    }

    // Offscreen composite of the layers behind the glass (background + slogan).
    // The shader samples this texture to fake refraction + frosted blur.
    const sceneTexture = new Texture(gl, {
      generateMipmaps: false,
      flipY: false,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    });
    const sceneCanvas = document.createElement("canvas");
    const sceneCtx = sceneCanvas.getContext("2d");

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(0, 0, 0) },
        iMouse: { value: new Vec3(0, 0, 0) },
        iColor: { value: new Vec3(r1, g1, b1) },
        iCursorColor: { value: new Vec3(r2, g2, b2) },
        iAnimationSize: { value: animationSize },
        iBallCount: { value: ballCount },
        iCursorBallSize: { value: cursorBallSize },
        iMetaBalls: { value: metaBallsUniform },
        iClumpFactor: { value: clumpFactor },
        enableTransparency: { value: enableTransparency },
        iSceneTex: { value: sceneTexture },
        iHasScene: { value: false },
        iRefraction: { value: refraction * 0.06 },
        iFrost: { value: frost * 0.014 },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    const scene = new Transform();
    mesh.setParent(scene);

    const maxBalls = 50;
    const effectiveBallCount = Math.min(ballCount, maxBalls);
    const ballParams: Array<{
      st: number;
      dtFactor: number;
      baseScale: number;
      toggle: number;
      radius: number;
    }> = [];

    for (let i = 0; i < effectiveBallCount; i++) {
      const idx = i + 1;
      const h1 = hash31(idx);
      const st = h1[0] * (2 * Math.PI);
      const dtFactor = 0.1 * Math.PI + h1[1] * (0.4 * Math.PI - 0.1 * Math.PI);
      const baseScale = 5.0 + h1[1] * (10.0 - 5.0);
      const h2 = hash33(h1);
      const toggle = Math.floor(h2[0] * 2.0);
      const radiusVal = 0.5 + h2[2] * (2.0 - 0.5);
      ballParams.push({ st, dtFactor, baseScale, toggle, radius: radiusVal });
    }

    const mouseBallPos = { x: 0, y: 0 };
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;

    // ---- Scene texture (background + slogan) used for glass refraction --------
    const bgImage = new Image();
    const sloganImage = new Image();
    let bgLoaded = false;
    let sloganLoaded = false;

    function buildScene() {
      if (!sceneCtx) return;
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      if (w === 0 || h === 0) return;
      sceneCanvas.width = w;
      sceneCanvas.height = h;
      sceneCtx.clearRect(0, 0, w, h);

      if (bgLoaded) {
        const iw = bgImage.naturalWidth || w;
        const ih = bgImage.naturalHeight || h;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        sceneCtx.drawImage(bgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }

      if (sloganLoaded) {
        const sw = Math.min(sloganWidthVw * w, sloganMaxWidth);
        const sh = sw * sloganAspect;
        sceneCtx.drawImage(sloganImage, (w - sw) / 2, (h - sh) / 2, sw, sh);
      }

      sceneTexture.image = sceneCanvas;
      sceneTexture.needsUpdate = true;
      program.uniforms.iHasScene.value = bgLoaded || sloganLoaded;
    }

    bgImage.onload = () => {
      bgLoaded = true;
      buildScene();
    };
    sloganImage.onload = () => {
      sloganLoaded = true;
      buildScene();
    };
    bgImage.src = sceneSrc;
    sloganImage.src = sloganSrc;

    function resize() {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width * dpr, height * dpr);
      gl.canvas.style.width = width + "px";
      gl.canvas.style.height = height + "px";
      program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, 0);
      buildScene();
    }

    window.addEventListener("resize", resize);
    resize();

    function onPointerMove(e: PointerEvent) {
      if (!enableMouseInteraction) return;
      const rect = container!.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      pointerX = (px / rect.width) * gl.canvas.width;
      pointerY = (1 - py / rect.height) * gl.canvas.height;
    }

    function onPointerEnter() {
      if (!enableMouseInteraction) return;
      pointerInside = true;
    }

    function onPointerLeave() {
      if (!enableMouseInteraction) return;
      pointerInside = false;
    }

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerenter", onPointerEnter);
    container.addEventListener("pointerleave", onPointerLeave);

    const startTime = performance.now();
    let animationFrameId: number;

    function update(t: number) {
      animationFrameId = requestAnimationFrame(update);
      const elapsed = (t - startTime) * 0.001;
      program.uniforms.iTime.value = elapsed;

      for (let i = 0; i < effectiveBallCount; i++) {
        const p = ballParams[i];
        const dt = elapsed * speed * p.dtFactor;
        const th = p.st + dt;
        const x = Math.cos(th);
        const y = Math.sin(th + dt * p.toggle);
        const posX = x * p.baseScale * clumpFactor;
        const posY = y * p.baseScale * clumpFactor;
        metaBallsUniform[i].set(posX, posY, p.radius);
      }

      let targetX: number;
      let targetY: number;
      if (pointerInside) {
        targetX = pointerX;
        targetY = pointerY;
      } else {
        const cx = gl.canvas.width * 0.5;
        const cy = gl.canvas.height * 0.5;
        const rx = gl.canvas.width * 0.15;
        const ry = gl.canvas.height * 0.15;
        targetX = cx + Math.cos(elapsed * speed) * rx;
        targetY = cy + Math.sin(elapsed * speed) * ry;
      }
      mouseBallPos.x += (targetX - mouseBallPos.x) * hoverSmoothness;
      mouseBallPos.y += (targetY - mouseBallPos.y) * hoverSmoothness;
      program.uniforms.iMouse.value.set(mouseBallPos.x, mouseBallPos.y, 0);

      renderer.render({ scene, camera });
    }

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerenter", onPointerEnter);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    color,
    cursorBallColor,
    speed,
    enableMouseInteraction,
    hoverSmoothness,
    animationSize,
    ballCount,
    clumpFactor,
    cursorBallSize,
    enableTransparency,
    refraction,
    frost,
    sceneSrc,
    sloganSrc,
    sloganWidthVw,
    sloganMaxWidth,
    sloganAspect,
  ]);

  return <div ref={containerRef} className="relative h-full w-full" />;
};

export default MetaBalls;
