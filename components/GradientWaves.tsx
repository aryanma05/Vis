"use client";

import React, { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import "./GradientWaves.css";

export type GradientWavesDetail = "low" | "medium" | "high";

export interface GradientWavesProps {
  horizonColor?: string;
  waveColor?: string;
  crestColor?: string;
  speed?: number;
  amplitude?: number;
  waveScale?: number;
  waveRatio?: number;
  swell?: number;
  turbulence?: number;
  tilt?: number;
  zoom?: number;
  height?: number;
  fogDepth?: number;
  detail?: GradientWavesDetail;
  brightness?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  parallaxStrength?: number;
  grain?: boolean;
  grainIntensity?: number;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result) {
    return [1, 1, 1];
  }

  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const detailToSteps = (detail: GradientWavesDetail): number => {
  if (detail === "low") return 40;
  if (detail === "high") return 110;
  return 70;
};

const vertex = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;

out vec4 fragColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);

  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);

  return r.z - (
    sin(mx * freq.x) * uAmplitude +
    sin(my * freq.y) * uAmplitude +
    uHeight
  );
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;

  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;

    float dscene = plasma(pos + dist * dir, freq, tc);

    if (abs(dscene) < 0.1) break;

    dist += 0.9 * dscene;

    if (!(abs(dist) < MAX_DIST)) {
      return MAX_DIST;
    }
  }

  return dist;
}

void main() {
  float time = iTime * uSpeed;

  vec2 frequency = vec2(
    uWaveScale / 7.0,
    (uWaveScale * uWaveRatio) / 3.0
  );

  vec4 timeChannels = vec4(
    time / 0.130,
    time / 0.810,
    time / 0.200,
    time / 0.710
  );

  float cosine;
  float sine;

  float fieldOfView = (3.14159 / 2.3) / max(uZoom, 0.05);

  vec3 camera = vec3(0.0, 0.0, 30.0);

  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 direction = vec3(0.0, 0.0, -1.0);

  float uvLength = length(uv);
  float xRotation = fieldOfView * uvLength;

  cosine = cos(xRotation);
  sine = sin(xRotation);

  direction = mat3(
    1.0, 0.0, 0.0,
    0.0, cosine, -sine,
    0.0, sine, cosine
  ) * direction;

  vec2 normalizedUv = uvLength > 0.00001
    ? uv / uvLength
    : vec2(1.0, 0.0);

  cosine = normalizedUv.x;
  sine = normalizedUv.y;

  direction = mat3(
    cosine, -sine, 0.0,
    sine, cosine, 0.0,
    0.0, 0.0, 1.0
  ) * direction;

  cosine = cos(uTilt);
  sine = sin(uTilt);

  direction = mat3(
    cosine, 0.0, sine,
    0.0, 1.0, 0.0,
    -sine, 0.0, cosine
  ) * direction;

  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;

    cosine = cos(yaw);
    sine = sin(yaw);

    direction = mat3(
      cosine, 0.0, sine,
      0.0, 1.0, 0.0,
      -sine, 0.0, cosine
    ) * direction;

    cosine = cos(pitch);
    sine = sin(pitch);

    direction = mat3(
      1.0, 0.0, 0.0,
      0.0, cosine, -sine,
      0.0, sine, cosine
    ) * direction;
  }

  float distance = raymarch(camera, direction, frequency, timeChannels);
  vec3 position = camera + distance * direction;

  float fog = clamp(uFogDepth / max(distance, 0.001), 0.0, 1.0);

  vec3 waveBody = mix(
    uWaveColor,
    uCrestColor,
    clamp(position.z * 0.08 + 0.5, 0.0, 1.0)
  );

  vec3 color = mix(uHorizonColor, waveBody, fog);
  color *= uBrightness;
  color = clamp(color, 0.0, 1.0);

  float alpha = clamp(fog, 0.0, 1.0) * uOpacity;

  if (uGrain > 0.5) {
    float noise = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (noise - 0.5) * uGrainIntensity;
  }

  alpha = clamp(alpha, 0.0, 1.0);

  fragColor = vec4(color * alpha, alpha);
}
`;

type GradientWavesContext = {
  renderer: InstanceType<typeof Renderer>;
  program: InstanceType<typeof Program>;
  mesh: InstanceType<typeof Mesh>;
};

const contextMap = new WeakMap<HTMLDivElement, GradientWavesContext>();

export default function GradientWaves({
  horizonColor = "#5227FF",
  waveColor = "#FF9FFC",
  crestColor = "#FFFFFF",
  speed = 0.4,
  amplitude = 2.5,
  waveScale = 0.6,
  waveRatio = 0.9,
  swell = 35,
  turbulence = 20,
  tilt = 1.11,
  zoom = 1,
  height = 5.5,
  fogDepth = 15,
  detail = "medium",
  brightness = 1,
  opacity = 1,
  mouseInteraction = true,
  parallaxStrength = 0.5,
  grain = true,
  grainIntensity = 0.05,
  className = "",
}: GradientWavesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseEnabledRef = useRef(mouseInteraction);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    container.appendChild(canvas);

    const geometry = new Triangle(gl);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: speed },
        uAmplitude: { value: amplitude },
        uWaveScale: { value: waveScale },
        uWaveRatio: { value: waveRatio },
        uSwell: { value: swell },
        uTurbulence: { value: turbulence },
        uTilt: { value: tilt },
        uZoom: { value: zoom },
        uHeight: { value: height },
        uFogDepth: { value: fogDepth },
        uSteps: { value: detailToSteps(detail) },
        uBrightness: { value: brightness },
        uOpacity: { value: opacity },
        uGrain: { value: grain ? 1 : 0 },
        uGrainIntensity: { value: grainIntensity },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uParallax: { value: parallaxStrength },
        uEnableMouse: { value: mouseInteraction },
        uHorizonColor: {
          value: new Float32Array(hexToRgb(horizonColor)),
        },
        uWaveColor: {
          value: new Float32Array(hexToRgb(waveColor)),
        },
        uCrestColor: {
          value: new Float32Array(hexToRgb(crestColor)),
        },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    contextMap.set(container, { renderer, program, mesh });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const heightValue = Math.max(1, Math.floor(rect.height));

      renderer.setSize(width, heightValue);

      const resolution = (
        program.uniforms.iResolution as { value: Float32Array }
      ).value;

      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const currentMouse: [number, number] = [0.5, 0.5];
    const targetMouse: [number, number] = [0.5, 0.5];

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();

      targetMouse[0] = (event.clientX - rect.left) / rect.width;
      targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height;
    };

    const onPointerLeave = () => {
      targetMouse[0] = 0.5;
      targetMouse[1] = 0.5;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      (program.uniforms.iTime as { value: number }).value =
        (time - startTime) / 1000;

      const x = mouseEnabledRef.current ? targetMouse[0] : 0.5;
      const y = mouseEnabledRef.current ? targetMouse[1] : 0.5;

      currentMouse[0] += (x - currentMouse[0]) * 0.05;
      currentMouse[1] += (y - currentMouse[1]) * 0.05;

      const mouse = (
        program.uniforms.uMouse as { value: Float32Array }
      ).value;

      mouse[0] = currentMouse[0];
      mouse[1] = currentMouse[1];

      renderer.render({ scene: mesh });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);

      contextMap.delete(container);

      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }

      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const context = container ? contextMap.get(container) : undefined;

    if (!context) return;

    const uniforms = context.program.uniforms as Record<
      string,
      { value: unknown }
    >;

    mouseEnabledRef.current = mouseInteraction;

    uniforms.uSpeed.value = speed;
    uniforms.uAmplitude.value = amplitude;
    uniforms.uWaveScale.value = waveScale;
    uniforms.uWaveRatio.value = waveRatio;
    uniforms.uSwell.value = swell;
    uniforms.uTurbulence.value = turbulence;
    uniforms.uTilt.value = tilt;
    uniforms.uZoom.value = zoom;
    uniforms.uHeight.value = height;
    uniforms.uFogDepth.value = fogDepth;
    uniforms.uSteps.value = detailToSteps(detail);
    uniforms.uBrightness.value = brightness;
    uniforms.uOpacity.value = opacity;
    uniforms.uGrain.value = grain ? 1 : 0;
    uniforms.uGrainIntensity.value = grainIntensity;
    uniforms.uParallax.value = parallaxStrength;
    uniforms.uEnableMouse.value = mouseInteraction;

    const horizon = uniforms.uHorizonColor.value as Float32Array;
    const wave = uniforms.uWaveColor.value as Float32Array;
    const crest = uniforms.uCrestColor.value as Float32Array;

    const horizonRgb = hexToRgb(horizonColor);
    const waveRgb = hexToRgb(waveColor);
    const crestRgb = hexToRgb(crestColor);

    horizon.set(horizonRgb);
    wave.set(waveRgb);
    crest.set(crestRgb);
  }, [
    horizonColor,
    waveColor,
    crestColor,
    speed,
    amplitude,
    waveScale,
    waveRatio,
    swell,
    turbulence,
    tilt,
    zoom,
    height,
    fogDepth,
    detail,
    brightness,
    opacity,
    mouseInteraction,
    parallaxStrength,
    grain,
    grainIntensity,
  ]);

  return (
    <div
      ref={containerRef}
      className={`gradient-waves-container ${className}`.trim()}
    />
  );
}