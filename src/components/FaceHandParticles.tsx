import React, { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

/* 
  FaceHandParticles
  - MediaPipe Tracking (Face + Hands)
  - 3D Particle System (Attract/Repel)
*/

const PARTICLE_COUNT = 4000;
const PREVIEW_WIDTH = 256;
const PREVIEW_HEIGHT = 144;

export function FaceHandParticles({
    videoElement,
    isCameraOn,
    canvasRef,
    mode,
    setStatus
}: {
    videoElement: HTMLVideoElement | null;
    isCameraOn: boolean;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    mode: 'attract' | 'repel';
    setStatus: (s: string) => void;
}) {
    // MediaPipe Processors
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const lastVideoTimeRef = useRef(-1);
    const { viewport } = useThree();

    // Particle System Refs
    const pointsRef = useRef<THREE.Points>(null);
    const geometryRef = useRef<THREE.BufferGeometry>(null);

    // Physics State
    const particles = useMemo(() => {
        const data = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            data.push({
                x: (Math.random() - 0.5) * 10,
                y: (Math.random() - 0.5) * 10,
                z: (Math.random() - 0.5) * 5,
                vx: 0, vy: 0, vz: 0,
                targetIndex: Math.floor(Math.random() * 468), // Default to face
                targetType: Math.random() > 0.3 ? 'face' : 'hand', // 70% face, 30% hand
                color: new THREE.Color(0.2, 0.8, 1.0)
            });
        }
        return data;
    }, []);

    const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
    const colors = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

    // ... (rest is fine) -> Jump to return

    useEffect(() => {
        const initAI = async () => {
            setStatus("Loading MediaPipe...");
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });

                setStatus("Show your hands/face");
            } catch (err) {
                console.error("MediaPipe Init Error:", err);
                setStatus("AI Init Failed");
            }
        };

        initAI();
    }, [setStatus]);

    const baseColor = useRef(new THREE.Color(0.0, 1.0, 0.5)); // Cyan-Green
    const targetColor = useRef(new THREE.Color(1.0, 0.0, 0.5)); // Pink
    const isFist = useRef(false);

    useFrame(() => {
        if (!isCameraOn || !videoElement || !faceLandmarkerRef.current || !handLandmarkerRef.current) return;

        // 1. Process Video
        if (videoElement.currentTime !== lastVideoTimeRef.current && videoElement.readyState >= 2) {
            lastVideoTimeRef.current = videoElement.currentTime;

            const faceResult = faceLandmarkerRef.current.detectForVideo(videoElement, performance.now());
            const handResult = handLandmarkerRef.current.detectForVideo(videoElement, performance.now());

            // Detect Fist (Simple logic: Fingertip close to wrist)
            let fistDetected = false;
            if (handResult.landmarks.length > 0) {
                handResult.landmarks.forEach(hand => {
                    // Wrist is 0. Middle Tip is 12. 
                    const wrist = hand[0];
                    const middleTip = hand[12];
                    const dist = Math.sqrt(
                        Math.pow(wrist.x - middleTip.x, 2) + Math.pow(wrist.y - middleTip.y, 2)
                    );
                    if (dist < 0.3) fistDetected = true; // Norm coordinates
                });
            }
            isFist.current = fistDetected;

            // Render Overlay
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && canvasRef.current) {
                canvasRef.current.width = PREVIEW_WIDTH;
                canvasRef.current.height = PREVIEW_HEIGHT;
                ctx.save();
                ctx.scale(-1, 1); // Mirror
                ctx.translate(-PREVIEW_WIDTH, 0);
                ctx.drawImage(videoElement, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

                // Draw Skeletons
                const drawingUtils = new DrawingUtils(ctx);

                if (faceResult.faceLandmarks) {
                    for (const landmarks of faceResult.faceLandmarks) {
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#FF3030' });
                        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#30FF30' });
                    }
                }

                if (handResult.landmarks) {
                    for (const landmarks of handResult.landmarks) {
                        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
                        drawingUtils.drawLandmarks(landmarks, { color: '#FF00FF', lineWidth: 1, radius: 2 });
                    }
                }
                ctx.restore();
            }

            // Update Particle Targets
            particles.forEach((p, i) => {
                // Color Cycling
                if (isFist.current) {
                    p.color.lerp(targetColor.current, 0.05);
                } else {
                    p.color.lerp(baseColor.current, 0.05);
                }

                let tx = p.x, ty = p.y, tz = p.z;
                let found = false;

                // Scale factors to map normalized (0..1) to World coords (-X..X)
                const SX = viewport.width;
                const SY = -viewport.height; // Flip Y

                if (p.targetType === 'face' && faceResult.faceLandmarks.length > 0) {
                    const lm = faceResult.faceLandmarks[0]; // First face
                    const pt = lm[p.targetIndex % lm.length];
                    // Simple Z boost
                    tx = (pt.x - 0.5) * SX;
                    ty = (pt.y - 0.5) * SY;
                    tz = -pt.z * 10;
                    found = true;
                } else if (p.targetType === 'hand' && handResult.landmarks.length > 0) {
                    const handIdx = i % handResult.landmarks.length;
                    const lm = handResult.landmarks[handIdx];
                    const idxA = Math.floor(Math.random() * 21);
                    const pt = lm[idxA];
                    tx = (pt.x - 0.5) * SX;
                    ty = (pt.y - 0.5) * SY;
                    tz = -pt.z * 10;
                    found = true;
                }

                if (found && mode === 'attract') {
                    // Attraction
                    p.vx += (tx - p.x) * 0.01;
                    p.vy += (ty - p.y) * 0.01;
                    p.vz += (tz - p.z) * 0.01;
                } else if (mode === 'repel') {
                    // Repel / Explode
                    p.vx += (p.x) * 0.02; // Push away from center
                    p.vy += (p.y) * 0.02;
                    p.vz += (p.z) * 0.02;
                }

                // IDLE float if lost
                if (!found) {
                    p.vx += (Math.random() - 0.5) * 0.002;
                    p.vy += (Math.random() - 0.5) * 0.002;
                    p.vz += (Math.random() - 0.5) * 0.002;
                }

                // Physics Update
                p.vx *= 0.90; // Damping
                p.vy *= 0.90;
                p.vz *= 0.90;

                p.x += p.vx;
                p.y += p.vy;
                p.z += p.vz;

                // Update arrays
                let ptr = i * 3;
                positions[ptr] = -p.x; // Mirror X
                positions[ptr + 1] = p.y;
                positions[ptr + 2] = p.z;

                colors[ptr] = p.color.r;
                colors[ptr + 1] = p.color.g;
                colors[ptr + 2] = p.color.b;
            });

            if (geometryRef.current) {
                geometryRef.current.attributes.position.needsUpdate = true;
                geometryRef.current.attributes.color.needsUpdate = true;
            }
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry ref={geometryRef}>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-color" args={[colors, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.15} vertexColors transparent opacity={0.8} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
    );
}

// 2D Overlay Component
export function CameraPreviewOverlay({ canvasRef, status, mode, setMode }: {
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    status: string,
    mode: 'attract' | 'repel',
    setMode: (m: 'attract' | 'repel') => void
}) {
    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto z-50">
            {/* 256x144 Preview Box */}
            <div className="relative w-[256px] h-[144px] bg-black/50 border border-purple-500/50 rounded-lg overflow-hidden shadow-lg backdrop-blur">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full object-cover"
                    width={PREVIEW_WIDTH}
                    height={PREVIEW_HEIGHT}
                    style={{ transform: 'scale(1, 1)' }} // Canvas drawImage already flipped/scaled
                />
                <div className="absolute bottom-1 right-2 text-[10px] items-center text-purple-300 animate-pulse font-mono bg-black/50 px-1 rounded">
                    {status}
                </div>
            </div>

            {/* Mode Controls */}
            <div className="flex gap-2">
                <button
                    onClick={() => setMode('attract')}
                    className={`px-3 py-1 text-xs rounded-full backdrop-blur-md transition-all ${mode === 'attract' ? 'bg-purple-500 text-white' : 'bg-white/10 text-gray-400'}`}
                >
                    Attract
                </button>
                <button
                    onClick={() => setMode('repel')}
                    className={`px-3 py-1 text-xs rounded-full backdrop-blur-md transition-all ${mode === 'repel' ? 'bg-pink-500 text-white' : 'bg-white/10 text-gray-400'}`}
                >
                    Repel
                </button>
            </div>
        </div>
    );
}
