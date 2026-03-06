'use client'

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FileText } from 'lucide-react'

export default function TermsPage() {
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
              <FileText className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-white text-3xl sm:text-5xl font-semibold tracking-tight drop-shadow-[0_1px_8px_rgba(31,61,188,0.25)] mb-4">
              Terms of <span className="text-blue-400">Service</span>
            </h1>
            <p className="text-gray-300/90 text-sm sm:text-base">
              Last Updated: December 7, 2025
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-left">
            <div className="space-y-8 text-gray-300/90 text-sm leading-relaxed">
              <section>
                <h2 className="text-white text-3xl font-bold mb-6">VIBRACODE<br />TERMS OF SERVICE</h2>
                <p className="mb-4">
                  Kurdosoft LTD ("Company", "we", or "us"), owns and operates the VibraCode application and related products and services (all of the foregoing, together with all related documentation and all content and services provided thereon, including without limitation any Created Apps, collectively, the "Application" or the "Services"). These Terms of Service (the "Agreement") are a legally binding agreement between you ("you") and the Company and govern your use of the Services.
                </p>
                <p className="mb-4">
                  You agree that by downloading, installing, registering for a User Account, or using the Services, you (A) acknowledge that you have read and understand this Agreement and our Privacy Policy; (B) represent that you are of legal age to enter into a binding agreement or that, if you are not, your legal guardian has reviewed and agrees to this Agreement and our Privacy Policy on your behalf and is granting you permission to use the Services; and (C) accept this Agreement and our Privacy Policy and agree that you are legally bound by the terms hereof and thereof.
                </p>
                <p className="mb-4 font-semibold text-yellow-400">
                  ARBITRATION NOTICE AND CLASS ACTION WAIVER: EXCEPT FOR CERTAIN TYPES OF DISPUTES DESCRIBED IN THE ARBITRATION SECTION BELOW, YOU AGREE THAT DISPUTES BETWEEN YOU AND US WILL BE RESOLVED BY BINDING, INDIVIDUAL ARBITRATION AND YOU WAIVE YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.
                </p>
                <p className="font-semibold">
                  IF YOU DO NOT AGREE TO THIS AGREEMENT OR ANY OF THE TERMS HEREOF, YOU MUST DELETE THE APPLICATION FROM ALL OF YOUR DEVICES AND CEASE ALL USE OF THE SERVICES.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">1. CHANGES TO THE AGREEMENT</h2>
                <p>
                  We reserve the right to revise and update this Agreement from time to time in our sole discretion. When we do, we will provide you with notice by posting a notice on the Services, by sending you an email, or by any other means we reasonably deem appropriate. All changes are effective immediately when we post, send, or otherwise transmit notice thereof, and apply to all access to and use of the Services and any Created Apps thereafter. However, any changes to the dispute resolution provisions set out in the Governing Law and Arbitration sections below will not apply to any disputes for which the parties have actual notice before the date the change is posted, sent, or otherwise transmitted. Your continued use of the Services following such notice means that you accept and agree to the changes. If you do not agree to the revised or updated Agreement, your sole remedy is to discontinue your use of the Services and any Created Apps and delete all of the foregoing from all of your Devices.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">2. Eligibility</h2>
                <p>
                  The Services are intended solely for users who are 13 years of age or older. If you are under the age of 13, you are not permitted to use the Services. If you access the Services in violation of this policy, you are solely responsible for compliance with local laws.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">3. Services; Generative AI</h2>
                <p className="mb-4">
                  <strong>3.1</strong> The Services enable you to create mobile software applications ("Created Apps") without requiring you to code the Created Apps directly. Using visual, text, and audio inputs, the Services may be able to code a Created App that you may use in accordance with this Agreement.
                </p>
                <p>
                  <strong>3.2</strong> The Services use artificial intelligence and large language models ("AI Technology") to develop Created Apps. These technologies are new and developing and may generate Created Apps and other outputs that contain incorrect, incomplete, inaccurate, outdated, or biased information. Created Apps and other outputs may be defective or contain errors, security flaws, and/or third-party intellectual property, and may not operate as intended. You should not rely on any Created Apps or other outputs, and you are solely responsible for independently confirming the accuracy, functionality, and suitability thereof.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">4. License Grant</h2>
                <p>
                  Subject to your compliance with terms of this Agreement, we grant you a limited, personal, revocable, non-exclusive, and nontransferable license to download, install, and use the Services for your personal, non-commercial use on a reasonable number of personal devices owned or otherwise controlled by you ("Devices") strictly in accordance with the Application's documentation. You are solely responsible for the internet connection and/or mobile or other charges that you may incur for accessing and/or using the Services on your Devices.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">5. License Restrictions</h2>
                <p className="mb-3">You shall not:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>copy the Services, except as expressly permitted by the license granted in Section 4;</li>
                  <li>access the Services through any automated or non-human means;</li>
                  <li>modify, translate, adapt, or otherwise create derivative works or improvements, whether or not patentable, of the Services;</li>
                  <li>reverse engineer, disassemble, decompile, decode, or otherwise attempt to derive or gain access to the source code of the Services or any part thereof;</li>
                  <li>use any data mining tool, robots, or similar data gathering or extraction tools in connection with the Services;</li>
                  <li>remove, delete, alter, or obscure any trademarks or any copyright, trademark, patent, or other intellectual property or proprietary rights notices from the Services;</li>
                  <li>circumvent, disable, or otherwise interfere with any security-related features of the Services;</li>
                  <li>frame or link to the Services without our authorization;</li>
                  <li>rent, lease, lend, sell, resell, sublicense, assign, distribute, publish, transfer, or otherwise make available the Services to any third party;</li>
                  <li>engage in any conduct that restricts, inhibits, or otherwise interferes with the ability of any other person to use or enjoy the Services;</li>
                  <li>use the Services to transmit or distribute material that may be harmful to or interfere with the Services;</li>
                  <li>use the Services in violation of any applicable laws or regulations;</li>
                  <li>use the Services in violation of our or any third party's intellectual property or other proprietary or legal rights;</li>
                  <li>interfere with or disrupt the Services, including but not limited to any servers or networks connected thereto.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">6. Reservation of Rights</h2>
                <p>
                  You acknowledge and agree that the Services are provided under license, and not sold, to you. You do not acquire any ownership interest in the Services under this Agreement, or any other rights thereto other than to use the Services in accordance with the license granted, and subject to all terms, conditions, and restrictions, under this Agreement. The Company and its licensors and service providers reserve and shall retain their entire right, title, and interest in and to the Services (including without limitation all source code, databases, functionality, software, algorithms, designs, audio, text, and graphics embodied therein) except as expressly licensed to you in this Agreement.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">7. Accounts; Termination</h2>
                <p className="mb-4">
                  <strong>7.1</strong> You must create an account (a "User Account") to use the Services. You agree to provide accurate, current, and complete information at all times and to update such information as necessary. You are solely responsible for keeping your User Account secure and confidential, and you will be solely responsible for all activities that occur under or in connection with your User Account. By creating a User Account, you are agreeing and opting in to receive communications from us via the Application, email, SMS, or any other means of communication.
                </p>
                <p className="mb-4">
                  <strong>7.2</strong> We may suspend, terminate, modify, or delete your User Account and/or any subscription you have purchased at any time for any reason, with or without notice to you, if: (i) you breach any term of this Agreement, (ii) you fail to timely pay or chargeback any fees you agreed to pay for the Services, (iii) if your User Account has not been used for 180 days or more, (iv) we determine to do so in our sole discretion, with or without cause.
                </p>
                <p className="mb-4">
                  <strong>7.3</strong> You understand that if you or we terminate or delete your User Account, you will lose access to any data associated with your User Account, including all Created Apps. You may not be able to recover or access such data, even if you repurchase a subscription.
                </p>
                <p className="mb-4">
                  <strong>7.4</strong> All provisions of this Agreement which by their nature should survive any termination or deletion of your account shall survive, including, without limitation, provisions relating to intellectual property, disclaimers of warranty, limitations of liability, indemnification, governing law, arbitration, and miscellaneous.
                </p>
                <p className="font-semibold">
                  YOU ACKNOWLEDGE AND AGREE THAT YOU WILL HAVE NO OWNERSHIP OR OTHER PROPERTY INTEREST IN ANY ACCOUNT THAT YOU CREATE IN CONNECTION WITH THE SERVICES.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">8. Transactions</h2>
                <p className="mb-4">
                  Certain features of the Services may be available for free. However, we generally require you to maintain a paid subscription to use the Services, at the fees we then charge as set forth in the relevant App Store.
                </p>
                <p className="mb-4">
                  <strong>8.1 Subscriptions.</strong> By clicking in the Application or the relevant App Store to purchase a subscription, you are agreeing to purchase a recurring subscription in accordance with this Agreement. You agree to pay all fees for any subscription you purchase until your subscription is canceled by you or by us. Your cancellation will take effect at the end of the current paid subscription term. You will not receive any pro-rata refund for any amounts paid under a subscription license.
                </p>
                <p className="mb-4">
                  <strong>8.2 Termination of Subscriptions.</strong> You may terminate any subscription within the Application under Manage Subscription: vibracodeapp.com/dashboard.
                </p>
                <p className="mb-4">
                  <strong>8.3 Changes in Fees.</strong> We may change the fees associated with any subscription or any features at any time in our sole discretion, with advance notice to you. If you do not agree to any increased fees, your sole recourse is to cancel your subscription.
                </p>
                <p className="mb-4">
                  <strong>8.4 Taxes.</strong> You agree to pay all applicable taxes incurred in connection with any transactions made on or through your Devices or User Account.
                </p>
                <p className="font-semibold">
                  ALL PAYMENTS FOR SUBSCRIPTIONS AND OTHER FEATURES ARE NON-REFUNDABLE. WE DO NOT ISSUE REFUNDS OR CREDITS FOR PARTIALLY USED SUBSCRIPTION PERIODS OR FOR UNUSED FEATURES.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">9. Collection and Use of Your Information</h2>
                <p>
                  You acknowledge that when you download, install, or use the Services, we may use automatic means to collect information about you, your Devices, and your use of the Services. All information we collect through or in connection with the Services is subject to our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">10. Ownership of User Content and Created Apps</h2>
                <p className="mb-4">
                  As between the parties, any information, materials, or other communications you transmit or submit to the Services ("User Content") will remain your property. You will and hereby do grant to the Company a non-exclusive, perpetual, transferable, sublicensable, royalty-free, irrevocable, worldwide license to use, process, store, and analyze your User Content (i) to develop Created Apps and provide the Services to you and (ii) to develop, optimize, and/or train our and/or our partners' AI Technology and the Services.
                </p>
                <p className="mb-4">
                  As between the parties, you own the Created Apps developed by the Services based on your inputs, and we do not claim any copyright in the code generated by the Services for Created Apps. Nonetheless, we cannot and do not make any guarantees about your ability to own any code created by the Services. It is possible that such code may not be capable of copyright ownership given various jurisdictions' laws on AI-generated content.
                </p>
                <p>
                  Unless and until we make available a code download feature, you will be required to continue your subscription in order to continue to utilize any Created Apps.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">11. Responsibility for User Content</h2>
                <p className="mb-4">
                  <strong>11.1</strong> We do not and cannot review all of your User Content, and the Company shall not be responsible for the content or results of any of your User Content. The Company reserves the right to block users or to remove User Content that it determines to be in violation of this Agreement.
                </p>
                <p>
                  <strong>11.2</strong> By making User Content available, you represent, warrant, and agree that (i) you have the right to make such User Content available; (ii) the User Content will not violate or infringe upon the rights of any third party; and (iii) the User Content will not violate any applicable law or regulation.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">12. Content Standards</h2>
                <p className="mb-3">User Content and your use of the Services must comply with all applicable laws and regulations. Neither your User Content nor your use of the Services will:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Contain or involve any material that is defamatory, obscene, scandalous, profane, indecent, abusive, offensive, threatening, harassing, violent, hateful, inflammatory, or otherwise objectionable;</li>
                  <li>Promote sexually explicit or pornographic material, violence, or discrimination;</li>
                  <li>Infringe any patent, trademark, trade secret, copyright, or other intellectual property rights;</li>
                  <li>Violate the legal rights of others or contain any material that could give rise to any civil or criminal liability;</li>
                  <li>Promote any illegal activity, or advocate, promote, or assist any unlawful act;</li>
                  <li>Engage in deceptive practices, mislead others, or conduct fraudulent activities;</li>
                  <li>Impersonate any person or business, or misrepresent your identity or affiliation.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">13. Updates; Availability and Features of the Services</h2>
                <p className="mb-4">
                  <strong>13.1</strong> We may from time to time develop and provide updates to the Services, which may include upgrades, bug fixes, patches, other error corrections, and/or new features ("Updates"). Updates may also modify or delete certain features and functionality. You agree that we have no obligation to provide any Updates or to continue to provide or enable any particular features or functionality.
                </p>
                <p className="mb-4">
                  <strong>13.2</strong> We reserve the right to change, suspend, remove, or disable access to the Services or any features or functionality thereof, including without limitation any Created Apps, at any time with or without notice.
                </p>
                <p>
                  <strong>13.3</strong> There may be times when the Services or a Created App is not available for technical or maintenance related reasons, and we shall have no liability for any such unavailability.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">14. Third-Party Materials</h2>
                <p>
                  The Services may display, include, or make available third-party content or provide links to third-party websites or services ("Third-Party Materials"). You acknowledge and agree that the Company is not responsible for Third-Party Materials. We do not assume and will not have any liability or responsibility to you for any Third-Party Materials. Third-Party Materials are provided solely as a convenience to you, and you access and use them entirely at your own risk.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">15. Disclaimer of Warranties</h2>
                <p className="mb-4 font-semibold">
                  THE SERVICES ARE PROVIDED TO YOU "AS IS," "AS AVAILABLE," AND WITH ALL FAULTS AND DEFECTS WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, THE COMPANY EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, WITH RESPECT TO THE SERVICES, INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
                </p>
                <p className="mb-4 font-semibold">
                  WITHOUT LIMITING THE FOREGOING, THE COMPANY PROVIDES NO WARRANTY OR UNDERTAKING THAT THE SERVICES WILL MEET YOUR REQUIREMENTS, ACHIEVE ANY INTENDED RESULTS, BE COMPATIBLE, OR WORK WITH ANY OTHER SOFTWARE, APPLICATIONS, SYSTEMS, OR SERVICES, OPERATE WITHOUT INTERRUPTION, MEET ANY PERFORMANCE OR RELIABILITY STANDARDS, OR BE ERROR-FREE.
                </p>
                <p className="font-semibold">
                  THE COMPANY SPECIFICALLY DISCLAIMS ANY RESPONSIBILITY FOR ACTIONS TAKEN OR NOT TAKEN OR THE PERFORMANCE OR NON-PERFORMANCE OR OPERATION OF ANY CREATED APPS.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">16. Limitation of Liability</h2>
                <p className="mb-4 font-semibold">
                  TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL THE COMPANY OR ITS AFFILIATES HAVE ANY LIABILITY ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICES FOR:
                </p>
                <ul className="list-disc pl-6 space-y-2 font-semibold mb-4">
                  <li>PERSONAL INJURY, PROPERTY DAMAGE, LOST PROFITS, COST OF SUBSTITUTE GOODS OR SERVICES, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, COMPUTER FAILURE OR MALFUNCTION, OR ANY OTHER CONSEQUENTIAL, INCIDENTAL, INDIRECT, EXEMPLARY, SPECIAL, OR PUNITIVE DAMAGES.</li>
                  <li>DIRECT DAMAGES IN AMOUNTS THAT IN THE AGGREGATE EXCEED THE AMOUNT ACTUALLY PAID BY YOU FOR THE SERVICES DURING THE SIX (6) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</li>
                </ul>
                <p className="font-semibold">
                  THE FOREGOING LIMITATIONS WILL APPLY WHETHER SUCH DAMAGES ARISE OUT OF BREACH OF CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE AND REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">17. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless the Company and its affiliates and their respective officers, directors, employees, and agents from and against any and all losses, damages, liabilities, deficiencies, claims, actions, judgments, settlements, interest, awards, penalties, fines, costs, or expenses of whatever kind, including reasonable attorneys' fees, arising from or relating to your use or misuse of the Services and any Created Apps or your breach of this Agreement.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">18. Governing Law</h2>
                <p>
                  All matters relating to the Services, any Created Apps, and this Agreement, and any dispute or claim arising therefrom or related thereto, shall be governed by and construed in accordance with the internal laws of the State of California without giving effect to any choice or conflict of law provision or rule.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">19. ARBITRATION</h2>
                <p className="mb-4">
                  <strong>19.1</strong> You and the Company agree that any dispute arising out of or related to the Services, any Created Apps, or this Agreement will be exclusively resolved through final and binding confidential arbitration. The arbitration shall be held in San Francisco, California. Notwithstanding the foregoing, either party may seek injunctive or other equitable relief from any state or federal court of competent jurisdiction to prevent irreparable harm to its intellectual property.
                </p>
                <p className="mb-4 font-semibold">
                  THERE IS NO JUDGE OR JURY IN ARBITRATION. BY USING THE SERVICES AND AGREEING TO THIS AGREEMENT, YOU ARE GIVING UP YOUR RIGHT TO HAVE ANY DISPUTE DECIDED IN A COURT OF LAW BEFORE A JUDGE OR JURY.
                </p>
                <p className="mb-4 font-semibold">
                  YOU AGREE THAT ANY ARBITRATION WILL BE CONDUCTED SOLELY ON AN INDIVIDUAL BASIS. IN NO EVENT MAY ANY SUCH ARBITRATION BE BROUGHT ON BEHALF OF A CLASS OR IN ANY OTHER CONSOLIDATED OR REPRESENTATIVE ACTION.
                </p>
                <p className="mb-4">
                  <strong>19.2 30-Day Right to Opt Out.</strong> You have the right to opt out and not be bound by the arbitration and class action waiver provisions by sending written notice to support@vibracodeapp.com with the subject line, "MANDATORY ARBITRATION AND CLASS ACTION WAIVER OPT-OUT." The notice must be sent within thirty (30) days of the effective date of this Agreement or the first date that you used the Services.
                </p>
                <p>
                  <strong>19.3</strong> If any part of this arbitration agreement or class action waiver is found to be invalid or unenforceable, then this entire Section 19 shall be null and void.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">20. Limitation of Time to File Claims</h2>
                <p className="font-semibold">
                  ANY CAUSE OF ACTION OR CLAIM YOU MAY HAVE ARISING OUT OF OR RELATING TO THE SERVICES, ANY CREATED APPS, OR THIS AGREEMENT MUST BE COMMENCED WITHIN ONE (1) YEAR AFTER THE CAUSE OF ACTION ACCRUES; OTHERWISE SUCH CAUSE OF ACTION OR CLAIM IS PERMANENTLY BARRED.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">21. Copyright Policy</h2>
                <p className="mb-4">
                  We respect the intellectual property of others. If you believe that one of our users is unlawfully infringing your copyrights through use of the Services, please provide written notification to our Designated Copyright Agent with the following information:
                </p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>A physical or electronic signature of a person authorized to act on behalf of the copyright owner;</li>
                  <li>Identification of the copyrighted works claimed to have been infringed;</li>
                  <li>Identification of the material that is claimed to be infringing;</li>
                  <li>Sufficient information to permit us to locate such material;</li>
                  <li>Your address, telephone number, and e-mail address;</li>
                  <li>A statement that you have a good faith belief that use of the material is not authorized by the copyright owner;</li>
                  <li>A statement that the information in the notification is accurate.</li>
                </ul>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <p className="font-semibold mb-2">Designated Copyright Agent:</p>
                  <p>Email: dmca@vibracodeapp.com</p>
                </div>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">22. Miscellaneous</h2>
                <p className="mb-4">
                  <strong>22.1 Waiver.</strong> No waiver by the Company of any term of this Agreement shall be deemed a further or continuing waiver of such term or a waiver of any other term.
                </p>
                <p className="mb-4">
                  <strong>22.2 Severability.</strong> If any provision of this Agreement is held invalid, illegal, or unenforceable, such provision shall be eliminated or limited to the minimum extent such that the remaining provisions will continue in full force and effect.
                </p>
                <p className="mb-4">
                  <strong>22.3 Entire Agreement.</strong> This Agreement and our Privacy Policy constitute the sole and entire agreement between you and the Company regarding the Services and any Created Apps.
                </p>
                <p className="mb-4">
                  <strong>22.4 Assignment.</strong> This Agreement may not be transferred or assigned by you, but may be transferred or assigned by the Company without restriction.
                </p>
                <p>
                  <strong>22.5 Relationship of the Parties.</strong> Nothing in this Agreement is intended to create any agency, partnership, joint venture, employment, or any other form of legal association between you and the Company.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">23. Feedback</h2>
                <p>
                  If you provide us with any feedback, ideas, suggestions, recommendations, or other communications ("Feedback"), we are free to use such Feedback irrespective of any other obligation or limitation between the parties. You will and hereby do assign to the Company all right, title, and interest in, and we are free to use, without any attribution or compensation to you, any ideas, know-how, concepts, techniques, or other intellectual property rights contained in the Feedback.
                </p>
              </section>

              <section>
                <h2 className="text-white text-2xl font-semibold mb-4">24. Contact Information</h2>
                <p className="mb-3">
                  For questions or concerns about these Terms, please contact us:
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
