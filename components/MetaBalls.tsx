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
uniform float iLightVariable;
uniform float iLightIntensity;
uniform float iStrokeWidth;
uniform float iOpacity;
uniform float iFrost;
uniform float iDepth;
out vec4 outColor;
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float getMetaBallValue(vec2 c, float r, vec2 p) {
  vec2 d = p - c;
  float dist2 = dot(d, d);
  return (r * r) / dist2;
}

vec3 gaussianBlurScene(vec2 uv, vec2 refr, float frostAmt) {
  float blurCurve = pow(clamp(frostAmt, 0.0, 1.0), 1.45);
  float sigma = mix(0.01, 0.085, blurCurve);
  vec3 acc = vec3(0.0);
  float weightSum = 0.0;

  for (int x = -4; x <= 4; x++) {
    for (int y = -4; y <= 4; y++) {
      vec2 tap = vec2(float(x), float(y));
      float w = exp(-dot(tap, tap) / 8.0);
      acc += texture(iSceneTex, uv + refr + tap * sigma).rgb * w;
      weightSum += w;
    }
  }

  vec3 blurred = acc / weightSum;

  // Second, wider pass softens detail into a frosted-glass read.
  acc = vec3(0.0);
  weightSum = 0.0;
  float wideSigma = sigma * mix(1.7, 2.45, blurCurve);
  for (int x = -3; x <= 3; x++) {
    for (int y = -3; y <= 3; y++) {
      vec2 tap = vec2(float(x), float(y));
      float w = exp(-dot(tap, tap) / 5.5);
      acc += texture(iSceneTex, uv + refr + tap * wideSigma).rgb * w;
      weightSum += w;
    }
  }
  vec3 wideBlur = acc / weightSum;

  // Extra-large blur only in high-frost range for true frosted glass.
  acc = vec3(0.0);
  weightSum = 0.0;
  float extraSigma = sigma * 3.6;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 tap = vec2(float(x), float(y));
      float w = exp(-dot(tap, tap) / 3.8);
      acc += texture(iSceneTex, uv + refr + tap * extraSigma).rgb * w;
      weightSum += w;
    }
  }
  vec3 extraBlur = acc / weightSum;
  float heavyMix = smoothstep(0.62, 1.0, frostAmt);
  return mix(mix(blurred, wideBlur, 0.6), extraBlur, heavyMix * 0.82);
}

vec3 applyLiquidGlass(vec3 color, float frostAmt) {
  // Keep transmission clear and avoid "milky" overlays.
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 saturated = mix(vec3(luma), color, 1.08);
  vec3 centered = saturated - vec3(0.5);
  color = vec3(0.5) + centered * mix(1.05, 1.16, frostAmt);
  return clamp(color, 0.0, 1.0);
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

  // Smooth spherical dome — softer cap avoids a flattened top.
  float height = smoothstep(0.45, 2.6, total);
  vec2 grad = vec2(dFdx(height), dFdy(height));
  float domeRoundness = mix(0.72, 0.38, iDepth);
  vec3 normal = normalize(vec3(-grad * mix(0.85, 1.25, iDepth), domeRoundness));

  if (f <= 0.0015) {
    outColor = vec4(0.0);
    return;
  }

  float lightAngle = iLightVariable * TAU;
  vec3 lightDir = normalize(
    vec3(cos(lightAngle) * 0.55, sin(lightAngle) * 0.45 + 0.18, 0.82)
  );
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);

  float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
  float tightSpecPower = mix(130.0, 46.0, iLightIntensity);
  float specTight = pow(clamp(dot(normal, halfDir), 0.0, 1.0), tightSpecPower) * iLightIntensity * 0.45;
  float specWide = pow(clamp(dot(normal, halfDir), 0.0, 1.0), 22.0) * iLightIntensity * 0.18;
  float specular = specTight + specWide;
  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 1.55) * 0.36 * iLightIntensity;

  vec3 tint = iColor;
  if (total > 0.0) {
    tint = iColor * (m1 / total) + iCursorColor * (m2 / total);
  }

  vec3 glass;
  float alpha;

  if (iHasScene) {
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    uv.y = 1.0 - uv.y;
    vec2 refr = normal.xy * iDepth * 0.07;
    float dispersion = mix(0.0007, 0.0022, iDepth) * (0.35 + fresnel * 1.6);
    vec3 blurred = gaussianBlurScene(uv, refr, iFrost);
    vec3 split = vec3(
      texture(iSceneTex, uv + refr + normal.xy * dispersion).r,
      texture(iSceneTex, uv + refr).g,
      texture(iSceneTex, uv + refr - normal.xy * dispersion).b
    );
    float splitMix = mix(0.26, 0.03, smoothstep(0.45, 1.0, iFrost));
    vec3 sceneCol = mix(blurred, split, splitMix);
    sceneCol = applyLiquidGlass(sceneCol, iFrost);
    float lighting = mix(1.03, 1.2, diffuse * iLightIntensity);
    glass = mix(sceneCol, tint, 0.03) * lighting;
    alpha = f * iOpacity;
  } else {
    glass = tint * mix(0.68, 0.92, diffuse * iLightIntensity);
    alpha = f * iOpacity * mix(0.35, 0.75, fresnel + 0.35);
  }

  glass += vec3(0.78, 0.88, 1.0) * fresnel;
  glass += vec3(1.0) * specular;
  float crest = pow(clamp(1.0 - abs(normal.y + 0.14), 0.0, 1.0), 11.0) * (0.11 + 0.09 * iLightIntensity);
  glass += vec3(1.0) * crest;

  // Tapered rim stroke: thin at poles, thicker mid-arc (#ffffff @ 70%).
  float azimuth = atan(normal.y, normal.x);
  float taper = mix(0.18, 1.0, pow(abs(sin(azimuth * 2.0)), 0.65));
  float strokePx = iStrokeWidth / iResolution.y;
  float edgeBand = smoothstep(0.08, 0.0, abs(total - 1.3) - strokePx * 3.5);
  float stroke = edgeBand * taper * 0.7;
  glass = mix(glass, vec3(1.0), stroke);
  alpha = clamp(alpha + stroke * 0.35, 0.0, 1.0);

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
  lightVariable?: number;
  lightIntensity?: number;
  strokeWidth?: number;
  opacity?: number;
  frost?: number;
  depth?: number;
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
  lightVariable = 0.4,
  lightIntensity = 0.6,
  strokeWidth = 1,
  opacity = 0.7,
  frost = 0.55,
  depth = 0.3,
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
        iLightVariable: { value: lightVariable },
        iLightIntensity: { value: lightIntensity },
        iStrokeWidth: { value: strokeWidth },
        iOpacity: { value: opacity },
        iFrost: { value: frost },
        iDepth: { value: depth },
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
    lightVariable,
    lightIntensity,
    strokeWidth,
    opacity,
    frost,
    depth,
    sceneSrc,
    sloganSrc,
    sloganWidthVw,
    sloganMaxWidth,
    sloganAspect,
  ]);

  return <div ref={containerRef} className="relative h-full w-full" />;
};

export default MetaBalls;
