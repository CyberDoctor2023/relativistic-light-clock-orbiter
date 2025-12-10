import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createProLightClock } from './SimulationCanvas';

interface RelativeViewProps {
  isRunning: boolean;
  speed: number;
  sharedSimState: React.MutableRefObject<{ photonPhase: number; photonDir: number }>;
}

export const RelativeView: React.FC<RelativeViewProps> = ({ isRunning, speed, sharedSimState }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  // We no longer need internal state for photon logic as we read from sharedSimState

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
    camera.position.set(0, 0, 35); 

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; 
    mountRef.current.appendChild(renderer.domElement);

    // --- ENVIRONMENT MAP (Studio Light for Metal) ---
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.5, 0.1);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // 2. Model (Imported Premium Metal Clock)
    const clockGroup = createProLightClock();
    clockGroup.rotation.x = 0.2;
    clockGroup.rotation.y = 0.3;
    scene.add(clockGroup);

    // 3. Photon
    const photonGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const photonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const photon = new THREE.Mesh(photonGeo, photonMat);
    scene.add(photon);
    const pLight = new THREE.PointLight(0xffffff, 1.0, 5);
    photon.add(pLight);

    // 4. Trail
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(300 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);

    // 5. Warp Starfield
    const starsCount = 400;
    const starsGeo = new THREE.BufferGeometry();
    const starsArr = new Float32Array(starsCount * 3);
    for(let i=0; i<starsCount; i++) {
        starsArr[i*3] = (Math.random() - 0.5) * 100; 
        starsArr[i*3+1] = (Math.random() - 0.5) * 100; 
        starsArr[i*3+2] = (Math.random() - 0.5) * 100 - 50; 
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starsArr, 3));
    const starsMat = new THREE.PointsMaterial({
        color: 0x88ccff,
        size: 0.5,
        transparent: true,
        opacity: 0.6
    });
    const starSystem = new THREE.Points(starsGeo, starsMat);
    scene.add(starSystem);

    // 6. Lighting - Studio Setup for Glossy Metal
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(10, 10, 20);
    scene.add(mainLight);
    
    const rimLight = new THREE.DirectionalLight(0xffffff, 2.0); 
    rimLight.position.set(-20, 0, -10);
    scene.add(rimLight);

    let animId: number;
    const animate = () => {
        animId = requestAnimationFrame(animate);

        if (isRunning) {
            // Warp speed effect for background stars
            const warpFactor = 0.2 + (speed * 2.0); 
            const posAttribute = starSystem.geometry.attributes.position;
            const positions = posAttribute.array as Float32Array;
            
            for(let i=0; i<starsCount; i++) {
                let z = positions[i*3+2];
                z += warpFactor; 
                if (z > 20) { 
                   z = -100;
                   positions[i*3] = (Math.random() - 0.5) * 100; 
                   positions[i*3+1] = (Math.random() - 0.5) * 100;
                }
                positions[i*3+2] = z;
            }
            posAttribute.needsUpdate = true;
        }

        // SYNC PHOTON POSITION FROM SHARED STATE
        // We read the exact phase from the main simulation so they move in perfect unison.
        const currentPhase = sharedSimState.current.photonPhase;

        const range = 3.0; // Matches new model height 6.0/2
        const y = -range + (currentPhase * (range * 2));
        const localPos = new THREE.Vector3(0, y, 0);
        localPos.applyEuler(clockGroup.rotation);
        photon.position.copy(localPos);

        const arr = trail.geometry.attributes.position.array as Float32Array;
        for(let i = arr.length - 1; i >= 3; i--) {
            arr[i] = arr[i-3];
        }
        arr[0] = photon.position.x;
        arr[1] = photon.position.y;
        arr[2] = photon.position.z;
        trail.geometry.attributes.position.needsUpdate = true;

        const rotSpeed = 0.002 + (speed * 0.05);
        clockGroup.rotation.y += rotSpeed;

        composer.render();
    };
    animate();

    const handleResize = () => {
        if(!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        renderer.setSize(w, h);
        composer.setSize(w, h);
        camera.aspect = w/h;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animId);
        renderer.dispose();
        pmremGenerator.dispose();
        roomEnvironment.dispose();
        composer.dispose();
        if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, [isRunning, speed, sharedSimState]);

  return (
    <div className="absolute top-8 right-8 w-56 h-80 rounded-lg border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden bg-black/60 backdrop-blur-xl hidden md:block">
        <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-white/10 to-transparent px-4 py-3 z-10 border-b border-white/10">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-cyan-400">Astronaut Frame</h3>
            <p className="text-[9px] text-white/60 mt-1 font-mono">
                LOCAL TIME: NORMAL <br/>
                <span className="text-cyan-300 opacity-70">VELOCITY: {(speed * 100).toFixed(0)}% c</span>
            </p>
        </div>
        <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};