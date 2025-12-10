import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; // Studio lighting for metal
import { SimulationScenario } from '../types';

interface SimulationCanvasProps {
  isRunning: boolean;
  orbitSpeedMultiplier: number;
  showTrail: boolean;
  scenario: SimulationScenario;
  sharedSimState: React.MutableRefObject<{ photonPhase: number; photonDir: number }>;
}

// --- HELPER: Authentic Stainless Steel Light Clock ---
export const createProLightClock = () => {
    const group = new THREE.Group();

    // 1. PURE STAINLESS STEEL (No Fake Glow)
    // Relies entirely on scene.environment for looks
    const steelMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05, // Very polished
        envMapIntensity: 1.0
    });

    // 2. Brushed Metal Accents (Slightly rougher)
    const brushedMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        metalness: 1.0,
        roughness: 0.4,
        envMapIntensity: 1.0
    });

    // 3. High-Grade Optical Glass
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.0,
        transmission: 0.98, // Very clear
        thickness: 1.0,
        transparent: true,
        opacity: 0.2
    });

    const height = 6.0;
    const radius = 2.5;
    const plateH = 0.2;

    // -- GEOMETRY CONSTRUCTION --

    // A. Top & Bottom Plates (Polished Steel Discs)
    const capGeo = new THREE.CylinderGeometry(radius, radius, plateH, 64);
    
    const topCap = new THREE.Mesh(capGeo, steelMat);
    topCap.position.y = (height/2) + (plateH/2);
    group.add(topCap);

    const botCap = new THREE.Mesh(capGeo, steelMat);
    botCap.position.y = -(height/2) - (plateH/2);
    group.add(botCap);

    // B. Inner Mirrors (Slightly inset)
    const mirrorGeo = new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, 0.05, 64);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.0 });
    
    const topMirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    topMirror.position.y = (height/2) - 0.05;
    group.add(topMirror);
    
    const botMirror = new THREE.Mesh(mirrorGeo, mirrorMat);
    botMirror.position.y = -(height/2) + 0.05;
    group.add(botMirror);

    // C. Structural Rods (Brushed Metal)
    const rodCount = 3;
    const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, height + plateH*2, 16);
    for(let i=0; i<rodCount; i++) {
        const angle = (i / rodCount) * Math.PI * 2;
        const r = radius * 0.9;
        const rod = new THREE.Mesh(rodGeo, brushedMat);
        rod.position.set(Math.cos(angle)*r, 0, Math.sin(angle)*r);
        group.add(rod);
    }

    // D. Central Glass Housing (Optional, subtle)
    const tubeGeo = new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, height, 64, 1, true);
    const tube = new THREE.Mesh(tubeGeo, glassMat);
    // group.add(tube); // Commented out for ultra-clean look, or uncomment if protection needed. 
    // Let's add minimal rings instead of full tube for "tech" look without occlusion.

    const ringGeo = new THREE.TorusGeometry(radius * 0.85, 0.05, 16, 64);
    const midRing = new THREE.Mesh(ringGeo, brushedMat);
    midRing.rotation.x = Math.PI / 2;
    group.add(midRing);

    return group;
};

// --- HELPER: Realistic Sun Shader ---
function createSunMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            varying vec3 vPosition;
            varying vec3 vNormal;

            // Ashima 3D Noise
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

            float snoise(vec3 v) {
                const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
                const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

                vec3 i  = floor(v + dot(v, C.yyy) );
                vec3 x0 = v - i + dot(i, C.xxx) ;

                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min( g.xyz, l.zxy );
                vec3 i2 = max( g.xyz, l.zxy );

                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy; 
                vec3 x3 = x0 - D.yyy;      

                i = mod289(i); 
                vec4 p = permute( permute( permute( 
                         i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                       + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                       + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

                float n_ = 0.142857142857; 
                vec3  ns = n_ * D.wyz - D.xzx;

                vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 

                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_ );    

                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);

                vec4 b0 = vec4( x.xy, y.xy );
                vec4 b1 = vec4( x.zw, y.zw );

                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));

                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

                vec3 p0 = vec3(a0.xy,h.x);
                vec3 p1 = vec3(a0.zw,h.y);
                vec3 p2 = vec3(a1.xy,h.z);
                vec3 p3 = vec3(a1.zw,h.w);

                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;

                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                            dot(p2,x2), dot(p3,x3) ) );
            }

            void main() {
                float slowTime = time * 0.4;
                float noise = snoise(vPosition * 0.15 + vec3(slowTime));
                float noise2 = snoise(vPosition * 0.4 - vec3(slowTime * 1.5));
                
                float combined = noise * 0.6 + noise2 * 0.4;
                
                vec3 cCore = vec3(1.0, 0.9, 0.5); 
                vec3 cMid = vec3(1.0, 0.4, 0.0);  
                vec3 cDark = vec3(0.6, 0.0, 0.0); 
                
                vec3 baseColor = mix(cMid, cCore, smoothstep(0.0, 0.8, combined));
                baseColor = mix(cDark, baseColor, smoothstep(-0.5, 0.2, combined));
                
                float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 3.0);
                vec3 glow = vec3(1.0, 0.5, 0.0) * fresnel * 1.5;
                
                gl_FragColor = vec4(baseColor + glow, 1.0);
            }
        `,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending
    });
}

// --- HELPER: Realistic Spiral Galaxy ---
function createSpiralGalaxy() {
    const particleCount = 20000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorInside = new THREE.Color(0xffddaa);
    const colorOutside = new THREE.Color(0x4488ff);

    for(let i = 0; i < particleCount; i++) {
        const radius = Math.random() * 400;
        const spinAngle = -radius * 0.08; 
        const branchAngle = (i % 3) * ((2 * Math.PI) / 3); 
        
        const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 - radius * 0.1);
        const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 - radius * 0.1);
        const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * (50 - radius * 0.1);

        const angle = spinAngle + branchAngle;
        
        const x = Math.cos(angle) * radius + randomX;
        const y = (Math.random() - 0.5) * (radius * 0.15) + randomY;
        const z = Math.sin(angle) * radius + randomZ;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, radius / 400);
        
        colors[i * 3] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;

        sizes[i] = Math.random() * 2.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });

    return new THREE.Points(geometry, material);
}

// --- HELPER: Seamless Linear Starfield ---
function createLinearStarfield() {
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for(let i=0; i<particleCount; i++) {
        positions[i*3] = (Math.random() - 0.5) * 4000; 
        const r = 80 + Math.random() * 1500;
        const theta = Math.random() * Math.PI * 2;
        positions[i*3+1] = r * Math.cos(theta); 
        positions[i*3+2] = r * Math.sin(theta); 
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true
    });

    return new THREE.Points(geometry, material);
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  isRunning,
  orbitSpeedMultiplier,
  showTrail,
  scenario,
  sharedSimState
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    controls: OrbitControls;
    objects: {
      sunLight?: THREE.PointLight;
      shipLight?: THREE.PointLight;
      fillLight?: THREE.HemisphereLight;
      sunGroup?: THREE.Group;
      earthGroup?: THREE.Group;
      earthMesh?: THREE.Mesh;
      cloudsMesh?: THREE.Mesh;
      shipGroup?: THREE.Group;
      shipMesh?: THREE.Group;
      clockApparatus?: THREE.Group;
      photon?: THREE.Mesh;
      trailLine?: THREE.Line;
      stars?: THREE.Points;
      galaxy?: THREE.Points;
      sunMaterial?: THREE.ShaderMaterial;
      linearStars?: THREE.Points;
    };
    state: {
      celestialTime: number; // For planets/galaxy (independent of slider)
      shipTime: number;      // For ship/clock (controlled by slider)
      linearOffset: number;
      photonPhase: number; 
      photonDir: number;
      trailPoints: THREE.Vector3[];
    }
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    scene.fog = new THREE.FogExp2(0x000000, 0.000005);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500000);
    camera.position.set(0, 40, 120);

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // --- ENVIRONMENT MAP FOR METALS (Studio Lighting) ---
    // This is crucial for the stainless steel look
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    // Subtle bloom for the sun, not the metal
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        0.4, 0.6, 0.1
    );
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); 
    scene.add(ambientLight);

    const fillLight = new THREE.HemisphereLight(0xddeeff, 0x000000, 0.5); 
    scene.add(fillLight);

    const sunLight = new THREE.PointLight(0xffaa55, 3.0, 0, 1.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    scene.add(sunLight);

    // --- OBJECTS ---
    const texLoader = new THREE.TextureLoader();
    
    // Stars
    const starsGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<5000; i++) {
        const r = 4000 + Math.random()*4000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2*Math.random()-1);
        starPos.push(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi));
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2}));
    scene.add(stars);

    // Galaxy
    const galaxy = createSpiralGalaxy();
    galaxy.rotation.x = 0.4; 
    scene.add(galaxy);

    // Linear Mode Starfield
    const linearStars = createLinearStarfield();
    linearStars.visible = false; 
    scene.add(linearStars);

    // Sun
    const sunGroup = new THREE.Group();
    scene.add(sunGroup);
    const sunMaterial = createSunMaterial();
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(15, 64, 64), sunMaterial);
    sunGroup.add(sunMesh);

    // Earth
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = 23.5 * Math.PI / 180; 
    earthGroup.add(tiltGroup);

    const earthMap = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
    const earthSpec = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');
    const earthNorm = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg');
    const earthClouds = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');

    const earthMesh = new THREE.Mesh(
        new THREE.SphereGeometry(10, 64, 64),
        new THREE.MeshPhongMaterial({
            map: earthMap,
            specularMap: earthSpec,
            normalMap: earthNorm,
            shininess: 15, 
            color: 0xffffff,
            emissive: 0x111111,
            emissiveIntensity: 0.2
        })
    );
    earthMesh.castShadow = true;
    earthMesh.receiveShadow = true;
    tiltGroup.add(earthMesh);

    const cloudsMesh = new THREE.Mesh(
        new THREE.SphereGeometry(10.1, 64, 64),
        new THREE.MeshLambertMaterial({
            map: earthClouds,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
        })
    );
    tiltGroup.add(cloudsMesh);

    const atmoMesh = new THREE.Mesh(
        new THREE.SphereGeometry(11.2, 64, 64),
        new THREE.ShaderMaterial({
            vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec3 vNormal; void main() { float intensity = pow(0.6 - dot(vNormal, vec3(0,0,1)), 4.0); gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity; }`,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        })
    );
    earthGroup.add(atmoMesh);

    // Ship & Clock
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);
    
    const shipMesh = new THREE.Group();
    shipGroup.add(shipMesh);

    // Extra light specifically to catch the metal highlights on the ship
    const shipLight = new THREE.PointLight(0xffffff, 1.5, 50);
    shipLight.position.set(10, 10, 10);
    shipGroup.add(shipLight);
    
    const clockApparatus = createProLightClock();
    shipMesh.add(clockApparatus);

    const photon = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    scene.add(photon);
    
    const pLight = new THREE.PointLight(0xffffff, 1.5, 8);
    photon.add(pLight);

    const trailGeo = new THREE.BufferGeometry();
    const trailMaxPoints = 5000;
    const trailPos = new Float32Array(trailMaxPoints * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    
    const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffaa00, opacity: 0.8, transparent: true }));
    trailLine.frustumCulled = false; 
    scene.add(trailLine);

    threeRef.current = {
        scene, camera, renderer, composer, controls,
        objects: { sunLight, shipLight, fillLight, sunGroup, earthGroup, earthMesh, cloudsMesh, shipGroup, shipMesh, clockApparatus, photon, trailLine, stars, galaxy, sunMaterial, linearStars },
        state: { celestialTime: 0, shipTime: 0, linearOffset: 0, photonPhase: 0.5, photonDir: 1, trailPoints: [] }
    };

    const handleResize = () => {
        if (!containerRef.current) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        pmremGenerator.dispose();
        roomEnvironment.dispose();
        if(containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // Scenario Configuration and Camera Reset
  useEffect(() => {
      if(!threeRef.current) return;
      const { camera, objects, controls, state } = threeRef.current;
      
      // --- CRITICAL FIX: RESET STATE TO PREVENT MISALIGNMENT ---
      state.shipTime = 0; 
      state.celestialTime = 0;
      state.linearOffset = 0;
      state.photonPhase = 0.5;
      state.photonDir = 1;
      
      // Sync Shared State on Reset
      if (sharedSimState && sharedSimState.current) {
        sharedSimState.current.photonPhase = 0.5;
        sharedSimState.current.photonDir = 1;
      }
      
      // Clear trails
      objects.trailLine!.geometry.setDrawRange(0,0);
      state.trailPoints = [];

      // Reset Camera Target strictly
      controls.reset(); // Reset internal control state
      controls.target.set(0,0,0);

      if (scenario === SimulationScenario.LINEAR) {
          camera.position.set(0, 10, 60);
          state.linearOffset = 0; 
          controls.target.set(0,0,0);
          if(objects.linearStars) objects.linearStars.visible = true;
          if(objects.stars) objects.stars.visible = true; 
      } else {
          if(objects.linearStars) objects.linearStars.visible = false;
          if(objects.stars) objects.stars.visible = true;
          
          if (scenario === SimulationScenario.EARTH_ORBIT) {
              camera.position.set(0, 60, 120);
          } else if (scenario === SimulationScenario.SOLAR_SYSTEM) {
              camera.position.set(0, 150, 250);
          } else {
              // GALAXY
              camera.position.set(0, 300, 500);
          }
      }
      controls.update();

  }, [scenario, sharedSimState]);

  // Loop
  useEffect(() => {
      if(!threeRef.current) return;
      const { composer, controls, objects, state, camera } = threeRef.current;
      let animId: number;

      const animate = () => {
          animId = requestAnimationFrame(animate);

          // Update Sun Material
          if(objects.sunMaterial) {
            objects.sunMaterial.uniforms.time.value += 0.01;
          }

          // --- PHYSICS CORE: STRICT RELATIVITY ---
          const SPEED_OF_LIGHT = 0.8; 
          const CLOCK_TRAVEL_DIST = 6.0; // Matches new model height (6.0)
          const vRatio = orbitSpeedMultiplier; // 0.0 to 0.99 (v/c)

          // Horizontal Speed (Ship)
          const vShip = vRatio * SPEED_OF_LIGHT;

          // Vertical Speed (Photon)
          const vVertical = Math.sqrt(1 - vRatio * vRatio) * SPEED_OF_LIGHT;
          const photonPhaseStep = vVertical / CLOCK_TRAVEL_DIST;

          if (isRunning) {
              // Independent Celestial Time: Planets move at "default" speed regardless of slider
              const CELESTIAL_DT = 0.02; 
              state.celestialTime += CELESTIAL_DT;
              
              // Ship Time: Relativistic time for the ship, controlled by slider
              state.shipTime += vShip * 0.05; 
              
              if (scenario === SimulationScenario.LINEAR) {
                  state.linearOffset += vShip;
                  
                  // Recycle Linear Stars
                  if (objects.linearStars && objects.linearStars.visible) {
                      const positions = objects.linearStars.geometry.attributes.position.array as Float32Array;
                      const count = positions.length / 3;
                      const camX = state.linearOffset;
                      const fieldWidth = 4000; 
                      const halfWidth = fieldWidth / 2;
                      
                      for(let i=0; i<count; i++) {
                          let x = positions[i*3];
                          if (x < camX - halfWidth) {
                              x += fieldWidth;
                          }
                          positions[i*3] = x;
                      }
                      objects.linearStars.geometry.attributes.position.needsUpdate = true;
                  }
              }

              state.photonPhase += state.photonDir * photonPhaseStep;
              if(state.photonPhase >= 1) { state.photonPhase = 1; state.photonDir = -1; }
              if(state.photonPhase <= 0) { state.photonPhase = 0; state.photonDir = 1; }
          }

          // --- SYNC SHARED STATE FOR RELATIVE VIEW ---
          if (sharedSimState && sharedSimState.current) {
              sharedSimState.current.photonPhase = state.photonPhase;
              sharedSimState.current.photonDir = state.photonDir;
          }

          // Galaxy Rotation (Counter-Clockwise) - Uses Celestial Time
          const galRot = state.celestialTime * 0.05;
          if(objects.galaxy) objects.galaxy.rotation.y = galRot;
          if(objects.stars) objects.stars.rotation.y = galRot * 0.2;

          // Earth Spin - Uses Celestial Time
          const earthSpin = state.celestialTime * 0.2;
          if(objects.earthMesh) objects.earthMesh.rotation.y = earthSpin;
          if(objects.cloudsMesh) objects.cloudsMesh.rotation.y = earthSpin * 1.2;

          // --- POSITIONING ---
          objects.sunGroup!.visible = false;
          objects.earthGroup!.visible = false;
          objects.galaxy!.visible = false;

          let shipPos = new THREE.Vector3();

          if (scenario === SimulationScenario.LINEAR) {
              objects.sunLight!.position.set(100, 50, 50);
              shipPos.set(state.linearOffset, 0, 0);
              objects.shipGroup!.position.copy(shipPos);
              objects.shipMesh!.rotation.set(0, 0, 0);
              objects.clockApparatus!.rotation.set(0.3, Math.PI/2, 0);
              
              // Apply Length Contraction
              const contraction = Math.sqrt(1 - orbitSpeedMultiplier*orbitSpeedMultiplier);
              objects.shipMesh!.scale.set(contraction, 1, 1);

              // Camera tracks ship
              camera.position.x = state.linearOffset;
              controls.target.set(state.linearOffset, 0, 0);

          } else {
              // Reset scale for orbit
              objects.shipMesh!.scale.set(1,1,1);

              // Orbital Scenarios
              const orbitR = 50; 
              let centerPos = new THREE.Vector3(0,0,0);
              let tiltAngle = 0; // Inclination of Solar System plane

              if (scenario === SimulationScenario.GALAXY) {
                  objects.galaxy!.visible = true;
                  objects.sunGroup!.visible = true;
                  objects.earthGroup!.visible = true;

                  // The Solar System plane (Ecliptic) is inclined ~60 degrees relative to Galactic Plane
                  tiltAngle = 60 * (Math.PI / 180);

                  const solarR = 300;
                  // Uses Celestial Time so it moves even if slider is 0
                  const sunOrbitAngle = state.celestialTime * 0.1 + Math.PI; 
                  
                  // Use -Math.sin for Counter-Clockwise motion
                  centerPos.set(Math.cos(sunOrbitAngle)*solarR, 0, -Math.sin(sunOrbitAngle)*solarR);
                  objects.sunGroup!.position.copy(centerPos);
                  // Move sunlight to follow the sun mesh
                  objects.sunLight!.position.copy(centerPos);
                  
                  // Earth orbits Sun (Tilted Plane) - Uses Celestial Time
                  const earthAngle = state.celestialTime * 2.0; 
                  const earthOrbitR = 60;
                  
                  // 1. Calculate flat orbit (Counter-Clockwise: -sin)
                  const ex = Math.cos(earthAngle) * earthOrbitR;
                  const ez = -Math.sin(earthAngle) * earthOrbitR;
                  
                  // 2. Apply Tilt (Rotate around X-axis to lift Z into Y)
                  const tx = ex;
                  const ty = ez * Math.sin(tiltAngle);
                  const tz = ez * Math.cos(tiltAngle);
                  
                  const earthOffset = new THREE.Vector3(tx, ty, tz);
                  objects.earthGroup!.position.copy(centerPos.clone().add(earthOffset));

              } else if (scenario === SimulationScenario.SOLAR_SYSTEM) {
                  objects.sunGroup!.visible = true;
                  objects.earthGroup!.visible = true;
                  objects.sunLight!.position.set(0,0,0);
                  objects.sunGroup!.position.set(0,0,0); // Ensure Sun is at center

                  // Solar System view is usually "Top Down" on ecliptic, so no tilt here for clarity
                  // Use -Math.sin for Counter-Clockwise motion, Celestial Time
                  centerPos.set(Math.cos(state.celestialTime * 0.3)*120, 0, -Math.sin(state.celestialTime * 0.3)*120);
                  objects.earthGroup!.position.copy(centerPos);
                  
              } else {
                  // EARTH_ORBIT
                  objects.earthGroup!.visible = true;
                  objects.sunLight!.position.set(100, 50, 100);
                  objects.earthGroup!.position.set(0,0,0);
              }

              let orbitCenter = (scenario === SimulationScenario.EARTH_ORBIT) ? new THREE.Vector3(0,0,0) : objects.earthGroup!.position;
              // Ship moves faster than earth based on slider speed (shipTime)
              const shipAngle = state.shipTime * 2.5; 

              // Calculate Ship Position (Orbiting Earth)
              // If we are in GALAXY mode, the ship should also follow the tilted plane to stay with Earth
              // Use -Math.sin for Counter-Clockwise motion
              const sx = Math.cos(shipAngle) * orbitR;
              const sz = -Math.sin(shipAngle) * orbitR;

              let fx = sx;
              let fy = 0;
              let fz = sz;
              
              if (tiltAngle !== 0) {
                 // Apply the same 60deg tilt to the ship's orbit around Earth
                 // so it doesn't detach from the planet
                 fy = sz * Math.sin(tiltAngle);
                 fz = sz * Math.cos(tiltAngle);
              }

              shipPos.set(fx, fy, fz).add(orbitCenter);

              objects.shipGroup!.position.copy(shipPos);
              
              // Update Rotation to face movement (Crude approx for tilted orbit)
              // Positive shipAngle for CCW rotation
              objects.shipMesh!.rotation.set(tiltAngle, shipAngle, 0);
              objects.clockApparatus!.rotation.set(0, 0, 0.3);
          }

          // --- PHOTON POSITION ---
          objects.clockApparatus!.updateMatrixWorld();
          const clockPos = new THREE.Vector3();
          const clockQuat = new THREE.Quaternion();
          objects.clockApparatus!.getWorldPosition(clockPos);
          objects.clockApparatus!.getWorldQuaternion(clockQuat);

          const range = 3.0; // Half of height (6.0 / 2)
          const localY = -range + (state.photonPhase * (range * 2));
          const localOffset = new THREE.Vector3(0, localY, 0);
          localOffset.applyQuaternion(clockQuat);
          
          const finalPhotonPos = clockPos.clone().add(localOffset);
          objects.photon!.position.copy(finalPhotonPos);

          // --- TRAIL ---
          if (showTrail && isRunning) {
              state.trailPoints.push(finalPhotonPos.clone());
              if(state.trailPoints.length > 5000) state.trailPoints.shift();
              if(scenario === SimulationScenario.LINEAR && state.trailPoints.length > 0) {
                 if(state.trailPoints[0].x < state.linearOffset - 1200) state.trailPoints.shift();
              }
          }
          if (!showTrail) state.trailPoints = [];

          const posArr = objects.trailLine!.geometry.attributes.position.array as Float32Array;
          let idx = 0;
          for(let p of state.trailPoints) {
              posArr[idx++] = p.x; posArr[idx++] = p.y; posArr[idx++] = p.z;
          }
          objects.trailLine!.geometry.setDrawRange(0, state.trailPoints.length);
          objects.trailLine!.geometry.attributes.position.needsUpdate = true;

          controls.update();
          composer.render();
      };
      animate();
      return () => cancelAnimationFrame(animId);

  }, [isRunning, orbitSpeedMultiplier, showTrail, scenario, sharedSimState]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};