import { useState, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ShapeCloud } from './components/ShapeCloud';
import { PointCloud } from './components/PointCloud';
import { audioManager } from './audio/AudioManager';
import { Mic, Play, Palette, Maximize, Minimize, MessageSquare, Copy } from 'lucide-react';
import { THINKOFF_COLORS, DEFAULT_COLOR, type ThemeColor } from './constants/Colors';
import { VoiceChatDemo } from './voice';
import './App.css';

function CameraUpdater({ domRef }: { domRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera } = useThree();
  useFrame(() => {
    if (domRef.current) {
      const p = camera.position;
      const r = camera.rotation;
      const dist = camera.position.length();
      const text =
        `Pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
        `Rot: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}\n` +
        `Dist: ${dist.toFixed(2)}`;
      domRef.current.innerText = text;
    }
  });
  return null;
}

function ViewUpdater({ mode }: { mode: 'shape' | 'point' }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const isAnimating = useRef(false);
  const startTime = useRef(0);

  useEffect(() => {
    isAnimating.current = true;
    startTime.current = Date.now();

    if (mode === 'shape') {
      // Shape Cloud: shorter zoom (40 → 20)
      camera.position.set(40, 0, 0);
      targetPos.current.set(20, 0, 0);
    } else { // mode === 'point'
      // Point Cloud: dramatic zoom (80 → 20)
      camera.position.set(80, 0, 0);
      targetPos.current.set(20, 0, 0);
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [mode, camera]);

  useFrame(() => {
    if (!isAnimating.current) return;

    // Stop after 4 seconds or if close enough
    if (Date.now() - startTime.current > 4000 || camera.position.distanceTo(targetPos.current) < 0.5) {
      isAnimating.current = false;
      return;
    }

    // Slower ease for cinematic effect
    camera.position.lerp(targetPos.current, 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function App() {
  // Check URL for voice chat mode
  const isVoiceChatMode = window.location.search.includes('voicechat') ||
    window.location.hash.includes('voicechat');

  const [started, setStarted] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ThemeColor>(DEFAULT_COLOR);
  const [mode, setMode] = useState<'shape' | 'point'>('shape');
  const [showMenu, setShowMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const debugRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState('Copy');

  const handleStart = async () => {
    await audioManager.start();
    setStarted(true);
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const el = document.documentElement as any;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) {
          await rfs.call(el);
          setIsFullscreen(true);
        } else {
          alert("Fullscreen feature is not supported by this browser.");
        }
      } else {
        const doc = document as any;
        const efs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (efs) {
          await efs.call(doc);
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.error("Fullscreen error:", e);
    }
  };

  const cycleColor = () => {
    const idx = THINKOFF_COLORS.findIndex(c => c.id === selectedColor.id);
    const nextIdx = (idx + 1) % THINKOFF_COLORS.length;
    setSelectedColor(THINKOFF_COLORS[nextIdx]);
  };

  const handleCopy = () => {
    if (!debugRef.current) return;
    navigator.clipboard.writeText(debugRef.current.innerText);
    setCopyStatus('Copied!');
    setTimeout(() => setCopyStatus('Copy'), 2000);
  };

  return (
    <div className="app-container">
      {/* Voice Chat Mode */}
      {isVoiceChatMode && <VoiceChatDemo />}

      {/* Visualizer Mode */}
      {!isVoiceChatMode && !started && (
        <div className="overlay-start">
          <div className="start-content">
            <h1>Spatiotemporal Visualizer</h1>
            <p>Web Edition</p>
            <button onClick={handleStart} className="start-btn">
              <Play size={24} />
              <span>Start Experience</span>
            </button>

            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>or try the new</p>
              <button
                onClick={() => window.location.href = 'https://thinkoff.app'}
                className="start-btn"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontSize: '1rem',
                  padding: '12px 24px',
                  minWidth: '220px',
                  height: 'auto'
                }}
              >
                <MessageSquare size={20} style={{ marginRight: '8px' }} />
                <span>Multi-AI Voice Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isVoiceChatMode && started && (
        <>
          {/* Full Screen Toggle - Moved Outside to fix clicking */}
          <button
            type="button"
            className="fullscreen-toggle"
            onClick={toggleFullScreen}
            style={{ zIndex: 200, pointerEvents: 'auto', outline: 'none' }}
          >
            {isFullscreen ? <Minimize size={24} color="#fff" /> : <Maximize size={24} color="#fff" />}
          </button>


          {/* UI Container for Hover Visibility */}
          <div className="interactive-ui">
            <div className="ui-overlay">
              <div className="status-indicator">
                <Mic size={16} color="#00ff00" />
                <span>Live Mic</span>
              </div>
            </div>

            {/* Debug Overlay - Moved Outside Canvas */}
            <div style={{
              position: 'absolute', bottom: 20, left: 20,
              zIndex: 100, pointerEvents: 'auto',
              background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div ref={debugRef} style={{
                color: '#0f0', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4',
                whiteSpace: 'pre-wrap'
              }}>Init...</div>
              <button onClick={handleCopy} style={{
                background: '#333', color: '#fff', border: '1px solid #555',
                padding: '4px', fontSize: '10px', cursor: 'pointer', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
              }}>
                <Copy size={10} />
                {copyStatus}
              </button>
            </div>



            {/* Mode Switcher */}
            <div className="mode-overlay">
              <button
                className={`mode-btn ${mode === 'shape' ? 'active' : ''}`}
                onClick={() => setMode('shape')}
              >
                Shape
              </button>
              <div className="divider" />
              <button
                className={`mode-btn ${mode === 'point' ? 'active' : ''}`}
                onClick={() => setMode('point')}
              >
                Point
              </button>
            </div>

            {/* Color Menu Toggle */}
            <div className="menu-toggle" onClick={() => setShowMenu(!showMenu)}>
              <Palette size={24} color={showMenu ? "#fff" : "rgba(255,255,255,0.5)"} />
            </div>

            {/* Voice Chat Toggle */}
            <div className="voice-chat-toggle" onClick={() => window.location.href = 'https://thinkoff.app'} title="Go to ThinkOff App">
              <MessageSquare size={24} color="#fff" />
            </div>

            {/* Color Selector */}
            {showMenu && (
              <div className="color-menu">
                <h3>Select Color</h3>
                <div className="color-grid">
                  {THINKOFF_COLORS.map(color => (
                    <button
                      key={color.id}
                      className={`color-btn ${selectedColor.id === color.id ? 'active' : ''}`}
                      style={{ backgroundColor: '#' + color.value.toString(16).padStart(6, '0') }}
                      onClick={() => setSelectedColor(color)}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Canvas
            camera={{ position: [0, 0, 15], fov: 60 }}
            onPointerMissed={() => cycleColor()} // Cycle color on background tap
          >
            <CameraUpdater domRef={debugRef} />
            <ViewUpdater mode={mode} />
            <color attach="background" args={['#000000']} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <ambientLight intensity={0.5} />

            {mode === 'shape' && <ShapeCloud selectedColor={selectedColor} />}
            {mode === 'point' && <PointCloud selectedColor={selectedColor} />}

            <OrbitControls key={mode} autoRotate autoRotateSpeed={0.5} enableZoom={true} />
          </Canvas>
        </>
      )
      }
    </div >
  );
}

export default App;
