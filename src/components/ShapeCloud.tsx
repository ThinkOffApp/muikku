import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager';
import { type ThemeColor } from '../constants/Colors';

const MAX_POINTS = 5000;
const minVal = [-2, -2, -2, -2];
const maxVal = [2, 2, 2, 2];
const smoothing = 0.005;

interface ShapeCloudProps {
    selectedColor: ThemeColor;
    analyser?: AnalyserNode | null;
    overrideColor?: string;
}

const createShapeTexture = (type: 'circle' | 'heart' | 'clover' | 'star') => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    ctx.scale(size / 2, size / 2);
    ctx.translate(1, 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'white';

    ctx.beginPath();
    if (type === 'circle') {
        ctx.arc(0, 0, 0.8, 0, Math.PI * 2);
    } else if (type === 'heart') {
        ctx.moveTo(0, 0.5);
        ctx.bezierCurveTo(-0.5, -0.2, -0.5, -0.8, 0, -0.3);
        ctx.bezierCurveTo(0.5, -0.8, 0.5, -0.2, 0, 0.5);
    } else if (type === 'clover') {
        const r = 0.4;
        ctx.arc(-r, -r, r, 0, Math.PI * 2);
        ctx.arc(r, -r, r, 0, Math.PI * 2);
        ctx.arc(-r, r, r, 0, Math.PI * 2);
        ctx.arc(r, r, r, 0, Math.PI * 2);
    } else if (type === 'star') {
        for (let i = 0; i < 5 * 2; i++) {
            const r = (i % 2 === 0) ? 0.9 : 0.4;
            const a = (Math.PI / 5 * i) - (Math.PI / 2);
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
};

export function ShapeCloud({ selectedColor, analyser, overrideColor }: ShapeCloudProps) {
    const { viewport } = useThree();
    const texCircle = useMemo(() => createShapeTexture('circle'), []);
    const texHeart = useMemo(() => createShapeTexture('heart'), []);
    const texClover = useMemo(() => createShapeTexture('clover'), []);
    const texStar = useMemo(() => createShapeTexture('star'), []);

    const systems = useMemo(() => ({
        circle: { history: [] as any[], pts: { current: null as THREE.Points | null }, pos: new Float32Array(MAX_POINTS * 3), col: new Float32Array(MAX_POINTS * 4) },
        heart: { history: [] as any[], pts: { current: null as THREE.Points | null }, pos: new Float32Array(MAX_POINTS * 3), col: new Float32Array(MAX_POINTS * 4) },
        clover: { history: [] as any[], pts: { current: null as THREE.Points | null }, pos: new Float32Array(MAX_POINTS * 3), col: new Float32Array(MAX_POINTS * 4) },
        star: { history: [] as any[], pts: { current: null as THREE.Points | null }, pos: new Float32Array(MAX_POINTS * 3), col: new Float32Array(MAX_POINTS * 4) }
    }), []);

    const circleRef = useRef<THREE.Points>(null);
    const heartRef = useRef<THREE.Points>(null);
    const cloverRef = useRef<THREE.Points>(null);
    const starRef = useRef<THREE.Points>(null);

    systems.circle.pts = circleRef;
    systems.heart.pts = heartRef;
    systems.clover.pts = cloverRef;
    systems.star.pts = starRef;

    const dataArray = useMemo(() => {
        return analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    }, [analyser]);

    // Pre-fill history to avoid cold start darkness
    useMemo(() => {
        // ... (init logic remains same) ...
        const totalInit = 2000;
        for (let i = 0; i < totalInit; i++) {
            // ...
            // Need to replicate Init Logic here since I truncated it in snippet
            const timeOffset = Math.random() * 5000;
            const pTime = Date.now() - timeOffset;
            const mockTime = (Date.now() / 1000) - (timeOffset / 1000);
            const theta = mockTime + (Math.random() * 2.0); // Match Android 2.0 multiplier
            const phi = Math.PI / 2 + (Math.random() * 4.0 - 2.0); // Full Sphere range (+/- 2.0)
            const rRadius = 10 + (Math.random() * 4);
            const x = rRadius * Math.sin(phi) * Math.cos(theta);
            const y = rRadius * Math.cos(phi);
            const z = rRadius * Math.sin(phi) * Math.sin(theta);
            const energy = 0.5;
            const w = Math.random();
            const p = { x, y, z, energy, time: pTime, r: 1, g: 0.5, b: 0.8, w };

            if (w > 0.75) systems.star.history.push(p);
            else if (w > 0.5) systems.clover.history.push(p);
            else if (w > 0.25) systems.heart.history.push(p);
            else systems.circle.history.push(p);
        }
    }, []);
    useFrame(() => {
        let features = [0, 0, 0, 0];
        if (analyser && dataArray) {
            analyser.getByteFrequencyData(dataArray);
            const getAvg = (start: number, end: number) => {
                let sum = 0;
                for (let i = start; i < end; i++) { sum += dataArray[i]; }
                return (sum / (end - start)) / 255;
            };
            features = [getAvg(0, 4), getAvg(4, 16), getAvg(16, 64), getAvg(64, 128)];
        } else {
            features = audioManager.getFeatures();
        }

        for (let i = 0; i < 4; i++) {
            if (maxVal[i] > minVal[i]) {
                const center = (maxVal[i] + minVal[i]) / 2;
                minVal[i] += (center - minVal[i]) * smoothing;
                maxVal[i] += (center - maxVal[i]) * smoothing;
            }
            const v = features[i];
            if (v < minVal[i]) minVal[i] = v;
            if (v > maxVal[i]) maxVal[i] = v;
        }
        const norm = (i: number) => {
            const range = Math.max(0.01, maxVal[i] - minVal[i]);
            return Math.max(-1, Math.min(1, 2 * (features[i] - minVal[i]) / range - 1));
        };

        const timeMs = Date.now();

        // ANDROID-STYLE DIRECT MAPPING (Cartesian)
        const baseScale = Math.min(viewport.width, viewport.height) * 0.45;
        const x = norm(1) * baseScale * (viewport.width / Math.min(viewport.width, viewport.height));
        const y = norm(2) * baseScale * (viewport.height / Math.min(viewport.width, viewport.height));
        const z = norm(3) * baseScale;

        const energy = (norm(0) + 1) / 2;
        const w = (norm(2) + 1) / 2;

        const currentBase = new THREE.Color(selectedColor.value);
        const confetti = new THREE.Color().setHSL(w, 1.0, 0.6);
        const mixRatio = Math.min(1.0, Math.max(0.0, (energy - 0.2) * 2.5));

        let r, g, b;
        if (overrideColor) {
            const c = new THREE.Color(overrideColor);
            r = c.r; g = c.g; b = c.b;
        } else {
            const c = currentBase.clone().lerp(confetti, mixRatio);
            c.multiplyScalar(1.5);
            r = c.r; g = c.g; b = c.b;
        }

        const pointData = { x, y, z, energy, time: timeMs, r, g, b, w };

        let target = systems.circle;
        if (w > 0.25) target = systems.heart;
        if (w > 0.5) target = systems.clover;
        if (w > 0.75) target = systems.star;

        target.history.push(pointData);
        if (target.history.length > MAX_POINTS / 4) target.history.shift();

        // Global energy for PULSE (Android uses currentEnergy)
        const globalEnergy = (features[0] + features[1] + features[2] + features[3]) / 4;

        Object.values(systems).forEach(sys => {
            if (!sys.pts.current) return;
            let ptr = 0;
            sys.history.forEach(p => {
                const age = timeMs - p.time;
                const lifeAlpha = Math.max(0.0, 1.0 - (age / 8000));
                const freshness = Math.max(0.0, 1.0 - (age / 200)); // Android: flash white for new points

                // DRIFT ANIMATION (Android style)
                const pW = p.w !== undefined ? p.w : 0.5;
                const driftX = Math.sin(timeMs * 0.001 + pW * 10) * 0.5;
                const driftY = Math.cos(timeMs * 0.0015 + pW * 10) * 0.5;
                const driftZ = Math.sin(timeMs * 0.0008 + pW * 5) * 0.3;

                sys.pos[ptr * 3] = p.x + driftX;
                sys.pos[ptr * 3 + 1] = p.y + driftY;
                sys.pos[ptr * 3 + 2] = p.z + driftZ;

                // Color with FRESHNESS FLASH (Android style)
                let pr = p.r, pg = p.g, pb = p.b;
                if (!overrideColor) {
                    const pConfetti = new THREE.Color().setHSL(pW, 1.0, 0.6);
                    const pMix = Math.min(1.0, Math.max(0.0, (p.energy - 0.2) * 2.5));

                    const sphereColor = currentBase.clone().lerp(pConfetti, pMix);

                    // Freshness flash (new points flash white)
                    const white = new THREE.Color(1, 1, 1);
                    const finalColor = sphereColor.clone().lerp(white, freshness * 0.7);
                    finalColor.multiplyScalar(1.5);

                    pr = finalColor.r;
                    pg = finalColor.g;
                    pb = finalColor.b;
                }

                // PULSE effect based on global energy (Android: only loud points pulse)
                const responsiveness = Math.max(0, (p.energy - 0.4)) * 2;
                const pulseBoost = 1 + (globalEnergy * 0.5 * responsiveness);

                // Apply pulse to alpha (brighter when pulsing)
                const boostedEnergy = Math.sqrt(p.energy);
                const alpha = lifeAlpha * (0.4 + 0.6 * boostedEnergy) * pulseBoost;

                sys.col[ptr * 4] = pr;
                sys.col[ptr * 4 + 1] = pg;
                sys.col[ptr * 4 + 2] = pb;
                sys.col[ptr * 4 + 3] = Math.min(1.0, alpha);
                ptr++;
            });

            for (let i = ptr; i < MAX_POINTS; i++) {
                sys.pos[i * 3] = 0;
                sys.col[i * 4] = 0;
                sys.col[i * 4 + 1] = 0;
                sys.col[i * 4 + 2] = 0;
                sys.col[i * 4 + 3] = 0;
            }

            sys.pts.current.geometry.attributes.position.needsUpdate = true;
            sys.pts.current.geometry.attributes.color.needsUpdate = true;
            sys.pts.current.rotation.y += 0.002;
        });
    });

    const renderSystem = (ref: any, pos: Float32Array, col: Float32Array, tex: THREE.Texture) => (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[pos, 3]} />
                <bufferAttribute attach="attributes-color" args={[col, 4]} />
            </bufferGeometry>
            <pointsMaterial
                map={tex}
                size={1.2}
                vertexColors
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                sizeAttenuation={true}
                alphaTest={0.01}
                opacity={1.0}
            />
        </points>
    );

    return (
        <group>
            {renderSystem(systems.circle.pts, systems.circle.pos, systems.circle.col, texCircle)}
            {renderSystem(systems.heart.pts, systems.heart.pos, systems.heart.col, texHeart)}
            {renderSystem(systems.clover.pts, systems.clover.pos, systems.clover.col, texClover)}
            {renderSystem(systems.star.pts, systems.star.pos, systems.star.col, texStar)}
        </group>
    );
}
