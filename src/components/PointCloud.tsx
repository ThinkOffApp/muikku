import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { audioManager } from '../audio/AudioManager';
import { type ThemeColor } from '../constants/Colors';

const MAX_POINTS = 5000;

// Dynamic Scaling State (matching Android)
const minVal = [-2, -2, -2, -2];
const maxVal = [2, 2, 2, 2];
const smoothing = 0.005;

interface PointCloudProps {
    selectedColor: ThemeColor;
}

export function PointCloud({ selectedColor }: PointCloudProps) {
    const pointsRef = useRef<THREE.Points>(null);
    const { viewport } = useThree();

    // Generate Soft Gradient Texture (Blurry Android Style)
    const circleTexture = useMemo(() => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
        }
        return new THREE.CanvasTexture(canvas);
    }, []);

    // Create Theme Colors
    const baseColor = useMemo(() => new THREE.Color(selectedColor.value), [selectedColor]);

    const positions = useMemo(() => new Float32Array(MAX_POINTS * 3), []);
    const colors = useMemo(() => new Float32Array(MAX_POINTS * 4), []); // RGBA for proper alpha
    const sizes = useMemo(() => new Float32Array(MAX_POINTS), []); // Dynamic sizing

    // Point History with all Android fields
    const pointHistory = useRef<Array<{
        x: number, y: number, z: number,
        energy: number, w: number, time: number,
        r: number, g: number, b: number
    }>>([]);

    // Pre-fill with ambient points (prevents cold start)
    useMemo(() => {
        const count = 2000;
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const r = 12 * Math.cbrt(Math.random());

            const w = Math.random(); // Timbre variety
            const confettiHue = w; // 0-1 mapped to HSL hue
            const confettiColor = new THREE.Color().setHSL(confettiHue, 0.9, 0.6);
            const mixed = baseColor.clone().lerp(confettiColor, 0.3);

            pointHistory.current.push({
                x: r * Math.sin(phi) * Math.cos(theta),
                y: r * Math.sin(phi) * Math.sin(theta),
                z: r * Math.cos(phi),
                energy: 0.4 + Math.random() * 0.3,
                w: w,
                time: Date.now() - Math.random() * 6000,
                r: mixed.r,
                g: mixed.g,
                b: mixed.b
            });
        }
    }, []);

    useFrame(() => {
        if (!pointsRef.current) return;

        const features = audioManager.getFeatures();

        // Dynamic Normalization (matching Android)
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
            const v = features[i];
            const range = Math.max(0.01, maxVal[i] - minVal[i]);
            const n = 2 * (v - minVal[i]) / range - 1;
            return Math.max(-1.5, Math.min(1.5, n));
        };

        const time = Date.now() / 1000;

        // ANDROID-STYLE CARTESIAN MAPPING WITH DRIFT
        const baseScale = Math.min(viewport.width, viewport.height) * 0.45;
        const aspectX = viewport.width / Math.min(viewport.width, viewport.height);
        const aspectY = viewport.height / Math.min(viewport.width, viewport.height);

        // Use norm(1), norm(2), norm(3) for primary spatial structure
        const nx = norm(1);
        const ny = norm(2);
        const nz = norm(3);
        const energy = (norm(0) + 1) / 2;
        const w = (norm(2) + 1) / 2; // Android uses Mid-band for color derivation (w)

        // DRIFT ANIMATION (Section 13.7)
        // This prevents the "line" effect by ensuring points move over time
        const driftX = Math.sin(time * 0.5 + w * 10) * 2.0;
        const driftY = Math.cos(time * 0.7 + w * 10) * 2.0;
        const driftZ = Math.sin(time * 0.4 + w * 10) * 2.0;

        const x = (nx * baseScale * aspectX) + driftX;
        const y = (ny * baseScale * aspectY) + driftY;
        const z = (nz * baseScale * aspectX) + driftZ; // Match X aspect for depth

        // CONFETTI COLOR (Android Logic)
        const confettiHue = (w + time * 0.05) % 1.0; // Add slow time drift to rainbow
        const confettiColor = new THREE.Color().setHSL(confettiHue, 0.9, 0.6);
        const mixRatio = Math.min(1.0, Math.max(0.0, (energy - 0.3) * 2.5));

        const mixed = baseColor.clone().lerp(confettiColor, mixRatio);
        mixed.multiplyScalar(1.3); // Brightness boost

        pointHistory.current.push({
            x, y, z, energy, w, time: Date.now(),
            r: mixed.r, g: mixed.g, b: mixed.b
        });

        if (pointHistory.current.length > MAX_POINTS) {
            pointHistory.current.shift();
        }

        // Global energy for PULSE (Android uses currentEnergy)
        const globalEnergy = (features[0] + features[1] + features[2] + features[3]) / 4;

        // Update Buffers
        let ptr = 0;
        for (let i = 0; i < pointHistory.current.length; i++) {
            const p = pointHistory.current[i];
            positions[ptr * 3] = p.x;
            positions[ptr * 3 + 1] = p.y;
            positions[ptr * 3 + 2] = p.z;

            const age = Date.now() - p.time;
            const lifeAlpha = Math.max(0, 1 - age / 8000);
            const freshness = Math.max(0, 1 - age / 200); // Flash white for new points

            // Recalculate Color with Freshness (Android style)
            const confettiHueP = p.w;
            const confettiP = new THREE.Color().setHSL(confettiHueP, 0.9, 0.6);
            const mixP = Math.min(1.0, Math.max(0.0, (p.energy - 0.3) * 2.5));
            const sphereColor = baseColor.clone().lerp(confettiP, mixP);

            // Freshness blend (new points flash white)
            const white = new THREE.Color(1, 1, 1);
            const finalColor = sphereColor.clone().lerp(white, freshness * 0.6);
            finalColor.multiplyScalar(1.2);

            colors[ptr * 4] = finalColor.r;
            colors[ptr * 4 + 1] = finalColor.g;
            colors[ptr * 4 + 2] = finalColor.b;

            // Alpha with depth/energy boost (Android: loud points cut through)
            const boostedEnergy = Math.sqrt(p.energy);
            const alpha = lifeAlpha * (0.4 + 0.6 * boostedEnergy);
            colors[ptr * 4 + 3] = Math.max(0.15, Math.min(1.0, alpha));

            // PULSE SIZE (Android: responsiveness based on energy)
            const responsiveness = Math.max(0, (p.energy - 0.4)) * 2;
            const pulseBoost = 1 + (globalEnergy * 0.6 * responsiveness);
            const baseSize = 0.6 + (p.energy * 0.8);
            sizes[ptr] = baseSize * pulseBoost;

            ptr++;
        }

        // Zero out rest
        for (let i = ptr; i < MAX_POINTS; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            colors[i * 4] = 0;
            colors[i * 4 + 1] = 0;
            colors[i * 4 + 2] = 0;
            colors[i * 4 + 3] = 0;
            sizes[i] = 0;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
        pointsRef.current.geometry.attributes.color.needsUpdate = true;
        pointsRef.current.geometry.attributes.size.needsUpdate = true;

        pointsRef.current.rotation.y -= 0.003;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 4]} />
                <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
            </bufferGeometry>
            <pointsMaterial
                map={circleTexture}
                size={0.8}
                vertexColors
                transparent
                depthWrite={false}
                alphaTest={0.001}
                opacity={1.0}
                blending={THREE.AdditiveBlending}
                sizeAttenuation={true}
            />
        </points>
    );
}
