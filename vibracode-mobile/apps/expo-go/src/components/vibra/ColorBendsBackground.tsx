import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';

const vertexShaderSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
varying vec2 vUv;

vec3 getColor(int i) {
  if (i == 0) return uColor0;
  else if (i == 1) return uColor1;
  else if (i == 2) return uColor2;
  else if (i == 3) return uColor3;
  else if (i == 4) return uColor4;
  else if (i == 5) return uColor5;
  else if (i == 6) return uColor6;
  else return uColor7;
}

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;

  vec3 col = vec3(0.0);
  float a = 1.0;

  if (uColorCount > 0) {
    vec2 s = q;
    vec3 sumCol = vec3(0.0);
    float cover = 0.0;

    for (int i = 0; i < 8; i++) {
      if (i >= uColorCount) break;
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float m = mix(m0, m1, kMix);
      float w = 1.0 - exp(-6.0 / exp(6.0 * m));
      sumCol += getColor(i) * w;
      cover = max(cover, w);
    }
    col = clamp(sumCol, 0.0, 1.0);
    a = uTransparent > 0 ? cover : 1.0;
  } else {
    vec2 s = q;
    for (int k = 0; k < 3; k++) {
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float m = mix(m0, m1, kMix);
      if (k == 0) col.r = 1.0 - exp(-6.0 / exp(6.0 * m));
      else if (k == 1) col.g = 1.0 - exp(-6.0 / exp(6.0 * m));
      else col.b = 1.0 - exp(-6.0 / exp(6.0 * m));
    }
    a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
  }

  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);
  }

  vec3 rgb = (uTransparent > 0) ? col * a : col;
  gl_FragColor = vec4(rgb, a);
}
`;

interface ColorBendsBackgroundProps {
  colors?: string[];
  rotation?: number;
  speed?: number;
  scale?: number;
  frequency?: number;
  warpStrength?: number;
  mouseInfluence?: number;
  parallax?: number;
  noise?: number;
  transparent?: boolean;
  autoRotate?: number;
  children?: React.ReactNode;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16) / 255,
      parseInt(h[1] + h[1], 16) / 255,
      parseInt(h[2] + h[2], 16) / 255,
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export const ColorBendsBackground: React.FC<ColorBendsBackgroundProps> = ({
  colors = ['#ff5c7a', '#8a5cff', '#00ffd1'],
  rotation = 45,
  speed = 0.2,
  scale = 1,
  frequency = 1,
  warpStrength = 1,
  mouseInfluence = 0,
  parallax = 0,
  noise = 0.1,
  transparent = false,
  autoRotate = 0,
  children,
}) => {
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const sizeRef = useRef({ width: 300, height: 600 });

  const propsRef = useRef({
    colors,
    rotation,
    speed,
    scale,
    frequency,
    warpStrength,
    mouseInfluence,
    parallax,
    noise,
    transparent,
    autoRotate,
  });

  useEffect(() => {
    propsRef.current = {
      colors,
      rotation,
      speed,
      scale,
      frequency,
      warpStrength,
      mouseInfluence,
      parallax,
      noise,
      transparent,
      autoRotate,
    };
  }, [
    colors,
    rotation,
    speed,
    scale,
    frequency,
    warpStrength,
    mouseInfluence,
    parallax,
    noise,
    transparent,
    autoRotate,
  ]);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    startTimeRef.current = Date.now();

    // Create vertex shader
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertShader) {
      console.error('Failed to create vertex shader');
      return;
    }
    gl.shaderSource(vertShader, vertexShaderSource);
    gl.compileShader(vertShader);
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vertShader));
      return;
    }

    // Create fragment shader
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragShader) {
      console.error('Failed to create fragment shader');
      return;
    }
    gl.shaderSource(fragShader, fragmentShaderSource);
    gl.compileShader(fragShader);
    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fragShader));
      return;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      return;
    }
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Create quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Get uniforms
    const u = {
      uCanvas: gl.getUniformLocation(program, 'uCanvas'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uSpeed: gl.getUniformLocation(program, 'uSpeed'),
      uRot: gl.getUniformLocation(program, 'uRot'),
      uColorCount: gl.getUniformLocation(program, 'uColorCount'),
      uColor0: gl.getUniformLocation(program, 'uColor0'),
      uColor1: gl.getUniformLocation(program, 'uColor1'),
      uColor2: gl.getUniformLocation(program, 'uColor2'),
      uColor3: gl.getUniformLocation(program, 'uColor3'),
      uColor4: gl.getUniformLocation(program, 'uColor4'),
      uColor5: gl.getUniformLocation(program, 'uColor5'),
      uColor6: gl.getUniformLocation(program, 'uColor6'),
      uColor7: gl.getUniformLocation(program, 'uColor7'),
      uTransparent: gl.getUniformLocation(program, 'uTransparent'),
      uScale: gl.getUniformLocation(program, 'uScale'),
      uFrequency: gl.getUniformLocation(program, 'uFrequency'),
      uWarpStrength: gl.getUniformLocation(program, 'uWarpStrength'),
      uPointer: gl.getUniformLocation(program, 'uPointer'),
      uMouseInfluence: gl.getUniformLocation(program, 'uMouseInfluence'),
      uParallax: gl.getUniformLocation(program, 'uParallax'),
      uNoise: gl.getUniformLocation(program, 'uNoise'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const colorUniforms = [
      u.uColor0,
      u.uColor1,
      u.uColor2,
      u.uColor3,
      u.uColor4,
      u.uColor5,
      u.uColor6,
      u.uColor7,
    ];

    const render = () => {
      rafRef.current = requestAnimationFrame(render);

      const props = propsRef.current;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const { width, height } = sizeRef.current;

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, props.transparent ? 0 : 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(u.uCanvas, width, height);
      gl.uniform1f(u.uTime, elapsed);
      gl.uniform1f(u.uSpeed, props.speed);
      gl.uniform1f(u.uScale, props.scale);
      gl.uniform1f(u.uFrequency, props.frequency);
      gl.uniform1f(u.uWarpStrength, props.warpStrength);
      gl.uniform2f(u.uPointer, 0, 0);
      gl.uniform1f(u.uMouseInfluence, props.mouseInfluence);
      gl.uniform1f(u.uParallax, props.parallax);
      gl.uniform1f(u.uNoise, props.noise);
      gl.uniform1i(u.uTransparent, props.transparent ? 1 : 0);

      // Rotation
      const deg = (props.rotation % 360) + props.autoRotate * elapsed;
      const rad = (deg * Math.PI) / 180;
      gl.uniform2f(u.uRot, Math.cos(rad), Math.sin(rad));

      // Colors
      const colorArr = (props.colors || []).slice(0, 8);
      gl.uniform1i(u.uColorCount, colorArr.length);
      for (let i = 0; i < 8; i++) {
        if (i < colorArr.length) {
          const [r, g, b] = hexToRgb(colorArr[i]);
          gl.uniform3f(colorUniforms[i], r, g, b);
        } else {
          gl.uniform3f(colorUniforms[i], 0, 0, 0);
        }
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
    };

    render();
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      sizeRef.current = { width, height };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#4a3520' }]} onLayout={handleLayout}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {children}
    </View>
  );
};

export default ColorBendsBackground;
