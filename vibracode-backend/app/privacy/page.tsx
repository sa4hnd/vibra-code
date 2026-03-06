'use client'

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Shield } from 'lucide-react'

export default function PrivacyPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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

          float wave1 = sin(uv.x * 10.0 + time * 2.0) * 0.1;
          float wave2 = sin(uv.y * 8.0 + time * 1.5) * 0.08;
          float wave3 = sin((uv.x + uv.y) * 6.0 + time * 2.5) * 0.06;

          float combined = wave1 + wave2 + wave3;

          float dist = distance(uv, center);
          float gradient = 1.0 - smoothstep(0.0, 0.7, dist);

          gradient += combined * 0.3;

          vec3 color = vec3(0.1, 0.3, 0.8) * gradient;

          float noise = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
          color += noise * 0.05;

          gl_FragColor = vec4(color, gradient * 0.3);
        }
      `,
    };

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

    const geometry = new THREE.PlaneGeometry(2, 2);

    const waveMaterial = new THREE.ShaderMaterial({
      ...WaveShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    const waveMesh = new THREE.Mesh(geometry, waveMaterial);
    scene.add(waveMesh);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5,
      0.4,
      0.85
    );
    composer.addPass(bloomPass);

    const filmGrainPass = new ShaderPass(FilmGrainShader);
    composer.addPass(filmGrainPass);

    let animationId: number;
    const startTime = Date.now();

    function animate() {
      animationId = requestAnimationFrame(animate);

      const elapsed = (Date.now() - startTime) / 1000;

      waveMaterial.uniforms.time.value = elapsed;
      waveMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
      filmGrainPass.uniforms.time.value = elapsed;

      composer.render();
    }
    animate();

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
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "120px 24px 80px 24px",
          overflowY: "auto",
        }}
      >
        <div
          className="max-w-4xl w-full text-center"
        >
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full mb-6">
              <Shield className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-white text-3xl sm:text-5xl font-semibold tracking-tight drop-shadow-[0_1px_8px_rgba(31,61,188,0.25)] mb-4">
              Privacy <span className="text-blue-400">Policy</span>
            </h1>
            <p className="text-gray-300/90 text-sm sm:text-base">
              Last Updated: December 7, 2025
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left">
            <div className="space-y-8 text-gray-300/90 text-sm leading-relaxed">
              <section>
                <h2 className="text-white text-3xl font-bold mb-6">VIBRACODE<br />PRIVACY POLICY</h2>
                <p className="mb-4">
                  This Privacy Policy ("Privacy Policy") explains how Kurdosoft LTD ("VibraCode," "we," "us," "our") collects, uses, shares, and protects your Personal Information when you use our mobile application and related services (collectively, the "Services"). "Personal Information" means information that identifies, relates to, describes, is reasonably capable of being associated with, or could reasonably be linked, directly or indirectly, with a particular person or household.
                </p>
                <p>
                  Please read this Privacy Policy carefully. By using the Services, you agree to our processing of your information in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">1. Personal Information We Collect</h2>

                <h3 className="text-white text-lg font-semibold mt-4 mb-2">1.1 Types of Personal Information Collected</h3>
                <p className="mb-3">We may collect the following information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Contact and account information,</strong> such as your name, email address, phone number, username, password, and any other information you submit through our Services.</li>
                  <li><strong>Communications between you and us and our Services.</strong> When you communicate with us, we may collect and save a record of our communications and any Personal Information provided during the communications. We also collect information you share while using our Service, including any text, audio, images, or other files you may input into our Services.</li>
                  <li><strong>Billing and financial information</strong> when you purchase our Services (e.g., billing contact name, billing address, payment details including credit card information, and your purchase history).</li>
                  <li><strong>Usage information</strong> when you use our Services, such as usage patterns and content, IP addresses, and other information collected through cookies, web beacons, and other tracking technologies.</li>
                </ul>

                <h3 className="text-white text-lg font-semibold mt-4 mb-2">1.2 Sources of Personal Information</h3>
                <p className="mb-3">We collect Personal Information from various sources including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Directly from you when you register for an account, use our Services, or otherwise when you provide it to us.</li>
                  <li>Automatically through your use of our Services.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">2. How We Use Personal Information</h2>
                <p className="mb-3">We use the Personal Information we collect for the following purposes:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>To provide and improve our Services:</strong> To operate the Services you request, process transactions, maintain your account, personalize the Services, and improve the functionality and user experience of our Services.</li>
                  <li><strong>Customer support:</strong> To communicate with you and respond to your inquiries.</li>
                  <li><strong>Analytics and research:</strong> To understand how users interact with our Services and identify usage trends.</li>
                  <li><strong>Marketing communications:</strong> To send you updates about us and our Services and provide information about products and services that may interest you.</li>
                  <li><strong>Security and fraud prevention:</strong> To verify accounts and Service access, prevent fraud, monitor for and address unauthorized activities, and enforce our Terms of Service.</li>
                  <li><strong>Legal compliance:</strong> To comply with applicable legal requirements, industry standards, and our policies, and participate in legal proceedings.</li>
                  <li><strong>Business transactions:</strong> To evaluate and carry out mergers, acquisitions, reorganizations, or other business transactions, and to support related business, accounting, recordkeeping, and legal functions.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">3. How We Disclose Your Personal Information</h2>
                <p className="mb-3">We may share your Personal Information with the following categories of recipients:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service Providers:</strong> Including IT support, website analytics, and email management, and other providers who support our business or assist in delivering our Services.</li>
                  <li><strong>Subsidiaries and Affiliates:</strong> Affiliates and subsidiaries.</li>
                  <li><strong>Government Authorities:</strong> Government agencies or law enforcement to comply with laws, regulations, legal processes, or government requests; to enforce this Privacy Policy and our Terms of Service; to protect the security of our services; to prevent harm, fraud, or illegal activity; or in emergencies where safety is at risk.</li>
                </ul>

                <p className="mt-4 mb-3">We may also disclose Personal Information for the following purposes:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Operating Our Services:</strong> To support functionality and performance of our Services.</li>
                  <li><strong>Marketing:</strong> To deliver relevant advertising on our Services and third-party platforms based on your interests.</li>
                  <li><strong>Fraud Prevention:</strong> To investigate and respond to suspected illegal or fraudulent activity, or to protect the rights and safety of us and our users.</li>
                  <li><strong>Legal Compliance:</strong> When required by law or to defend legal claims, protect our rights, or comply with a legal process like a subpoena or court order.</li>
                  <li><strong>Business Transfers:</strong> In case of a merger, acquisition, restructuring, or sale of assets, we may transfer Personal Information to buyers, lenders, auditors, legal, or financial advisors.</li>
                  <li><strong>With Your Consent:</strong> When you request or authorize the sharing of your Personal Information.</li>
                </ul>

                <p className="mt-4 font-semibold">
                  We do not sell your Personal Information. We share your Personal Information only as outlined in this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">4. Cookies and Tracking Technologies</h2>

                <h3 className="text-white text-lg font-semibold mt-4 mb-2">4.1 What Are Cookies and Web Beacons</h3>
                <p className="mb-3">
                  A cookie is a small file placed on your device. It may be possible to refuse to accept mobile cookies by activating the appropriate setting on your device. However, if you select this setting, you may be unable to access certain features of the Services.
                </p>
                <p>
                  Parts of the Services and our e-mails may contain small electronic files known as web beacons (also referred to as clear gifs, pixel tags, and single-pixel gifs) that permit us, for example, to count users who have visited certain webpages or opened an email and for other related statistics.
                </p>

                <h3 className="text-white text-lg font-semibold mt-4 mb-2">4.2 Types of Cookies We Use</h3>
                <p className="mb-3">We use the following types of cookies:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Essential cookies:</strong> Necessary for the operation of the Services, they enable core functionality such as security, account authentication, and storing your preferences.</li>
                  <li><strong>Analytical/performance/targeting cookies:</strong> Allow us to recognize and count the number of visitors and see how visitors use and move around the Services.</li>
                </ul>
                <p className="mt-3">
                  <strong>Do-Not-Track Signals</strong> – Our systems do not respond to browser or device "Do-Not-Track" signals. But you can limit tracking by adjusting cookie settings.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">5. Security of Your Personal Information</h2>
                <p>
                  We have implemented safeguards to protect collected Personal Information from loss, misuse, and unauthorized access, disclosure, alteration, or destruction. However, no security system is foolproof, and we cannot guarantee absolute data security.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>
                <p className="mb-3">Depending on your location, you may have certain rights regarding your Personal Information such as:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access and portability:</strong> Confirm whether we process your data and access it in a portable format.</li>
                  <li><strong>Delete:</strong> Request data deletion, subject to certain exceptions.</li>
                  <li><strong>Correct:</strong> Request correction of inaccurate information.</li>
                  <li><strong>Opt-Out of Targeted Advertising:</strong> Opt out of targeted ads, profiling, or the sale of your data.</li>
                </ul>
                <p className="mt-3">
                  To exercise your state rights, if applicable, email us at <a href="mailto:support@vibracodeapp.com" className="text-blue-400 hover:text-blue-300">support@vibracodeapp.com</a>.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">7. Notice to California Residents</h2>
                <p>
                  California residents may request a notice detailing categories of Personal Information shared with third parties for their direct marketing over the past 12 months. To make a request, email us at <a href="mailto:support@vibracodeapp.com" className="text-blue-400 hover:text-blue-300">support@vibracodeapp.com</a>.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">8. Notice to Users Outside the United States</h2>
                <p>
                  The Services are hosted in the United States. By using the Services, you consent to your information being transferred to our facilities and to the facilities of those third parties with whom we share information as described in this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">9. Data Retention</h2>
                <p>
                  We retain Personal Information only as long as necessary, in accordance with our data retention schedules and applicable legal or contractual obligations. Information may be retained to comply with applicable law, fulfil contractual obligations, anticipate or manage legal matters, or support the delivery of our Services. When we no longer need to retain your Personal Information, we will securely delete or anonymize it.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">10. Children's Privacy</h2>
                <p>
                  The Services are not intended for users under the age of 13. We do not knowingly collect Personal Information from anyone under 13. If we learn that we have collected Personal Information of a child under 13, we will delete the information promptly.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">11. Links to Other Websites and Services</h2>
                <p>
                  Our Services may include links to third-party websites or applications. These third-party websites or applications are governed by their own privacy policies, not this Privacy Policy. We are not responsible for such third parties' data practices. Before sharing any Personal Information with a third party, we recommend that you review their privacy policy and take appropriate steps to protect your information.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time in response to changing legal, technical, or business developments. The date at the top of this Privacy Policy indicates when it was last updated. We encourage you to periodically review this Privacy Policy to stay informed about how we are protecting your Personal Information.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">13. Contact Us</h2>
                <p className="mb-3">
                  For questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="font-semibold">Kurdosoft LTD</p>
                  <p>VibraCode</p>
                  <p>Email: <a href="mailto:support@vibracodeapp.com" className="text-blue-400 hover:text-blue-300">support@vibracodeapp.com</a></p>
                  <p>Website: <a href="https://vibracodeapp.com" className="text-blue-400 hover:text-blue-300">vibracodeapp.com</a></p>
                </div>
              </section>

              <section className="border-t border-white/10 pt-6 mt-8">
                <p className="text-center text-gray-400">
                  ← <a href="/" className="text-blue-400 hover:text-blue-300">Back to Home</a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

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
