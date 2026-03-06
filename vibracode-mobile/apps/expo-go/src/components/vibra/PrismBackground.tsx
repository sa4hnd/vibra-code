import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';

const vertexShaderSource = `
precision mediump float;
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Optimized shader - reduced iterations, simpler math
const fragmentShaderSource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uGlow;
uniform float uNoise;
uniform float uScale;
uniform float uColorFreq;
uniform float uTimeScale;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Normalized coords centered, adjusted for vertical
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  uv *= uScale;

  float t = iTime * uTimeScale;

  // Simple rotation
  float c = cos(t * 0.3);
  float s = sin(t * 0.3);
  uv = mat2(c, -s, s, c) * uv;

  // Prism shape - simplified pyramid SDF
  vec3 p = vec3(uv, 2.0);
  vec4 col = vec4(0.0);

  float z = 5.0;

  // Reduced iterations for mobile (40 instead of 100)
  for (int i = 0; i < 40; i++) {
    vec3 q = vec3(uv * z * 0.1, z);

    // Wobble
    float wt = t + float(i) * 0.1;
    q.x += sin(wt) * 0.1;
    q.z += cos(wt * 0.7) * 0.1;

    // Simple pyramid distance
    float py = abs(q.x) + abs(q.z) + q.y * 0.5 - 1.0;
    float d = max(py, -q.y) * 0.3;
    d = 0.1 + abs(d) * 0.3;

    z -= d;

    // Color accumulation
    col += (sin(vec4(0.0, 1.0, 2.0, 3.0) + (q.y + z) * uColorFreq) + 1.0) / (d * 50.0);
  }

  // Tone mapping
  col = 1.0 - exp(-col * uGlow * 0.01);
  col = clamp(col, 0.0, 1.0);

  // Noise
  float n = rand(gl_FragCoord.xy + vec2(iTime));
  col.rgb += (n - 0.5) * uNoise;

  gl_FragColor = vec4(clamp(col.rgb, 0.0, 1.0), 1.0);
}
`;

interface PrismBackgroundProps {
  glow?: number;
  noise?: number;
  scale?: number;
  colorFrequency?: number;
  timeScale?: number;
  children?: React.ReactNode;
}

function createShader(
  gl: ExpoWebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Prism shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: ExpoWebGLRenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Prism program error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export const PrismBackground: React.FC<PrismBackgroundProps> = ({
  glow = 1,
  noise = 0.3,
  scale = 2.5,
  colorFrequency = 1,
  timeScale = 0.5,
  children,
}) => {
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 300, height: 600 });

  const propsRef = useRef({ glow, noise, scale, colorFrequency, timeScale });

  useEffect(() => {
    propsRef.current = { glow, noise, scale, colorFrequency, timeScale };
  }, [glow, noise, scale, colorFrequency, timeScale]);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    startTimeRef.current = Date.now();

    const vertShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertShader || !fragShader) return;

    const program = createProgram(gl, vertShader, fragShader);
    if (!program) return;

    gl.useProgram(program);

    const vertices = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      iTime: gl.getUniformLocation(program, 'iTime'),
      uGlow: gl.getUniformLocation(program, 'uGlow'),
      uNoise: gl.getUniformLocation(program, 'uNoise'),
      uScale: gl.getUniformLocation(program, 'uScale'),
      uColorFreq: gl.getUniformLocation(program, 'uColorFreq'),
      uTimeScale: gl.getUniformLocation(program, 'uTimeScale'),
    };

    const render = () => {
      rafRef.current = requestAnimationFrame(render);

      const props = propsRef.current;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(uniforms.iResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(uniforms.iTime, elapsed);
      gl.uniform1f(uniforms.uGlow, props.glow);
      gl.uniform1f(uniforms.uNoise, props.noise);
      gl.uniform1f(uniforms.uScale, props.scale);
      gl.uniform1f(uniforms.uColorFreq, props.colorFrequency);
      gl.uniform1f(uniforms.uTimeScale, props.timeScale);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
    };

    render();
  }, []);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      sizeRef.current = { width, height };
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} onLayout={handleLayout}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {children}
    </View>
  );
};

export default PrismBackground;
