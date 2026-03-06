'use client'

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RotateCcw } from 'lucide-react'

export default function RefundPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Shaders ---
    const FilmGrainShader = {
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        time: { value: 0 },
        intensity: { value: 1.1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        varying vec2 vUv;
        
        float random(vec2 co) {
          return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float noise = random(vUv + time * 0.1) * intensity;
          color.rgb += noise * 0.1;
          gl_FragColor = color;
        }
      `,
    };

    const WaveShader = {
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2() },
        mouse: { value: new THREE.Vector2() },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        uniform vec2 mouse;
        varying vec2 vUv;
        
        void main() {
          vec2 uv = vUv;
          vec2 center = vec2(0.5);
          
          // Create flowing wave patterns
          float wave1 = sin(uv.x * 10.0 + time * 2.0) * 0.1;
          float wave2 = sin(uv.y * 8.0 + time * 1.5) * 0.08;
          float wave3 = sin((uv.x + uv.y) * 6.0 + time * 2.5) * 0.06;
          
          // Combine waves
          float combined = wave1 + wave2 + wave3;
          
          // Create gradient from center
          float dist = distance(uv, center);
          float gradient = 1.0 - smoothstep(0.0, 0.7, dist);
          
          // Apply wave distortion to gradient
          gradient += combined * 0.3;
          
          // Create blue-tinted color
          vec3 color = vec3(0.1, 0.3, 0.8) * gradient;
          
          // Add some noise for texture
          float noise = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
          color += noise * 0.05;
          
          gl_FragColor = vec4(color, gradient * 0.3);
        }
      `,
    };

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance"
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // --- Geometry & Materials ---
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const waveMaterial = new THREE.ShaderMaterial({
      ...WaveShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    
    const waveMesh = new THREE.Mesh(geometry, waveMaterial);
    scene.add(waveMesh);

    // --- Post Processing ---
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);

    const filmGrainPass = new ShaderPass(FilmGrainShader);
    composer.addPass(filmGrainPass);

    // --- Animation Loop ---
    let animationId: number;
    const startTime = Date.now();

    function animate() {
      animationId = requestAnimationFrame(animate);
      
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Update shader uniforms
      waveMaterial.uniforms.time.value = elapsed;
      waveMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
      filmGrainPass.uniforms.time.value = elapsed;
      
      composer.render();
    }
    animate();

    // --- Resize Handler ---
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
      
      waveMaterial.uniforms.resolution.value.set(width, height);
    }
    
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometry.dispose();
      waveMaterial.dispose();
      composer.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Content overlay matching homepage structure */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pointerEvents: "none",
          padding: "120px 24px 80px 24px",
          overflowY: "auto",
        }}
      >
        <div
          className="max-w-4xl w-full text-center"
          style={{ pointerEvents: "auto" }}
        >
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full mb-6">
              <RotateCcw className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-white text-3xl sm:text-5xl font-semibold tracking-tight drop-shadow-[0_1px_8px_rgba(31,61,188,0.25)] mb-4">
              Refund <span className="text-blue-400">Policy</span>
            </h1>
            <p className="text-gray-300/90 text-sm sm:text-base">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left">
            <div className="space-y-6 text-gray-300/90 text-sm">
              <section>
                <h2 className="text-white text-xl font-semibold mb-3">1. Refund Eligibility</h2>
                <p>Refunds are available for subscription payments within 7 days of the initial purchase or renewal, provided the service has not been extensively used.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">2. Refund Process</h2>
                <p>To request a refund, please contact our support team at hello@vibracodeapp.com with your account details and reason for the refund request.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">3. Processing Time</h2>
                <p>Refund requests are typically processed within 5-10 business days. Refunds will be issued to the original payment method used for the purchase.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">4. Non-Refundable Items</h2>
                <p>Credits consumed during usage, custom development services, and third-party integrations are generally non-refundable.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">5. Partial Refunds</h2>
                <p>In certain circumstances, we may offer partial refunds based on usage patterns and the specific situation.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">6. Chargeback Policy</h2>
                <p>If you initiate a chargeback without first contacting our support team, your account may be suspended pending resolution.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">7. Subscription Cancellation</h2>
                <p>Canceling your subscription will prevent future charges but does not automatically entitle you to a refund for the current billing period.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">8. Dispute Resolution</h2>
                <p>If you are not satisfied with our refund decision, you may contact us to discuss alternative resolutions.</p>
              </section>

              <section>
                <h2 className="text-white text-xl font-semibold mb-3">9. Contact Information</h2>
                <p>For refund requests or questions about this policy, please contact us at hello@vibracodeapp.com</p>
              </section>
            </div>
          </div>
        </div>
      </div>
      
      {/* Animated background canvas matching homepage */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: 0.8
        }}
      />
    </div>
  )
}
