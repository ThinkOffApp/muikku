/**
 * Voice Chat Demo Page
 * Interactive demo for multi-AI voice conversations
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Camera, CameraOff } from 'lucide-react';
import { MultiAIVoiceChatExtended, type ExtendedVoiceChatConfig } from './MultiAIVoiceChatExtended';
import { type Participant, type ConversationMessage, type VoiceChatEvent, type ParticipantProvider, PARTICIPANT_COLORS } from './types';
import { ShapeCloud } from '../components/ShapeCloud';
import { FaceHandParticles, CameraPreviewOverlay } from '../components/FaceHandParticles';

interface ProviderConfig {
  id: ParticipantProvider;
  name: string;
  description: string;
  requiresKey: boolean;
  isRealtime: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  { id: 'openai', name: 'GPT-5.2', description: 'OpenAI Realtime API (Preview)', requiresKey: true, isRealtime: true },
  { id: 'google', name: 'Gemini', description: 'Gemini Live API (voice-native)', requiresKey: true, isRealtime: true },
  { id: 'anthropic', name: 'Claude', description: 'Anthropic Claude 3.5 (TTS-based)', requiresKey: true, isRealtime: false },
  { id: 'mistral', name: 'Mistral', description: 'Mistral AI (TTS-based)', requiresKey: true, isRealtime: false },
  { id: 'grok', name: 'Grok', description: 'xAI Grok (TTS-based)', requiresKey: true, isRealtime: false },
  { id: 'meta', name: 'Llama', description: 'Meta Llama via Groq (TTS-based)', requiresKey: true, isRealtime: false },
  { id: 'perplexity', name: 'Perplexity', description: 'Perplexity AI (TTS-based)', requiresKey: true, isRealtime: false },
];

const VOICE_OPTIONS: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'alloy', name: 'Alloy' },
    { id: 'ash', name: 'Ash' },
    { id: 'ballad', name: 'Ballad' },
    { id: 'coral', name: 'Coral' },
    { id: 'echo', name: 'Echo' },
    { id: 'sage', name: 'Sage' },
    { id: 'shimmer', name: 'Shimmer' },
    { id: 'verse', name: 'Verse' },
  ],
  google: [
    { id: 'Puck', name: 'Puck' },
    { id: 'Charon', name: 'Charon' },
    { id: 'Kore', name: 'Kore' },
    { id: 'Fenrir', name: 'Fenrir' },
    { id: 'Aoede', name: 'Aoede' },
  ],
};

export const VoiceChatDemo: React.FC = () => {
  // API Keys state
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: '',
    google: '',
    anthropic: '',
    mistral: '',
    grok: '',
    meta: '',
    perplexity: '',
  });

  // Voice selections
  const [voices, setVoices] = useState<Record<string, string>>({
    openai: 'alloy',
    google: 'Puck',
    anthropic: 'coral',
    mistral: 'sage',
    grok: 'nova',
    meta: 'echo',
    perplexity: 'onyx',
  });

  // Enabled providers
  const [enabledProviders, setEnabledProviders] = useState<Set<ParticipantProvider>>(new Set());

  // System prompt
  const [systemPrompt, setSystemPrompt] = useState(
    'You are participating in a multi-AI voice conversation. Be concise (2-3 sentences max). ' +
    'Engage naturally with the user and other AI participants. Show your unique perspective.'
  );

  // Settings panel visibility
  const [showSettings, setShowSettings] = useState(true);

  // Chat state
  const [voiceChat, setVoiceChat] = useState<MultiAIVoiceChatExtended | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [textInput, setTextInput] = useState('');
  const [crossFeed, setCrossFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Camera State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [particleMode, setParticleMode] = useState<'attract' | 'repel'>('attract');
  const [particleStatus, setParticleStatus] = useState('Initializing...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraOn(true);
        }
      } catch (err) {
        console.error("Camera fail", err);
        setError("Camera access denied");
      }
    }
  }, [isCameraOn]);

  // Load saved keys from localStorage
  useEffect(() => {
    const savedKeys = localStorage.getItem('voicechat_api_keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error('Failed to load saved keys');
      }
    }
  }, []);

  // Save keys to localStorage
  const saveKeys = useCallback(() => {
    localStorage.setItem('voicechat_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  // Toggle provider enabled
  const toggleProvider = (id: ParticipantProvider) => {
    setEnabledProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle event from voice chat
  const handleEvent = useCallback((event: VoiceChatEvent) => {
    switch (event.type) {
      case 'connected':
        setIsConnected(true);
        setIsConnecting(false);
        setShowSettings(false);
        break;
      case 'disconnected':
        setIsConnected(false);
        break;
      case 'error':
        setError(String(event.data));
        setIsConnecting(false);
        break;
      case 'participant-joined':
        if (voiceChat) {
          setParticipants(voiceChat.getParticipants());
        }
        break;
      case 'transcript-update':
        if (voiceChat) {
          setHistory(voiceChat.getHistory());
        }
        break;
      case 'audio-level':
        if (event.participantId && event.data !== undefined) {
          setAudioLevels(prev => ({
            ...prev,
            [event.participantId!]: event.data as number,
          }));
        }
        break;
    }
  }, [voiceChat]);

  // Connect to voice chat
  const connect = useCallback(async () => {
    if (enabledProviders.size === 0) {
      setError('Please enable at least one AI provider');
      return;
    }

    // Validate API keys
    const missingKeys = Array.from(enabledProviders).filter(id => {
      const provider = PROVIDERS.find(p => p.id === id);
      return provider?.requiresKey && !apiKeys[id];
    });

    if (missingKeys.length > 0) {
      const names = missingKeys.map(id => PROVIDERS.find(p => p.id === id)?.name).join(', ');
      setError(`API key required for: ${names}`);
      return;
    }

    setIsConnecting(true);
    setError(null);

    const config: ExtendedVoiceChatConfig = {
      systemPrompt,
      enabledProviders: Array.from(enabledProviders),
    };

    // Add API keys for enabled providers
    if (enabledProviders.has('openai') && apiKeys.openai) {
      config.openAiApiKey = apiKeys.openai;
      config.openAiVoice = voices.openai;
    }
    if (enabledProviders.has('google') && apiKeys.google) {
      config.geminiApiKey = apiKeys.google;
      config.geminiVoice = voices.google;
    }
    if (enabledProviders.has('anthropic') && apiKeys.anthropic) {
      config.claudeApiKey = apiKeys.anthropic;
      config.claudeVoice = voices.anthropic;
    }
    if (enabledProviders.has('mistral') && apiKeys.mistral) {
      config.mistralApiKey = apiKeys.mistral;
      config.mistralVoice = voices.mistral;
    }
    if (enabledProviders.has('grok') && apiKeys.grok) {
      config.grokApiKey = apiKeys.grok;
      config.grokVoice = voices.grok;
    }
    if (enabledProviders.has('meta') && apiKeys.meta) {
      config.metaApiKey = apiKeys.meta;
      config.metaVoice = voices.meta;
    }
    if (enabledProviders.has('perplexity') && apiKeys.perplexity) {
      config.perplexityApiKey = apiKeys.perplexity;
      config.perplexityVoice = voices.perplexity;
    }

    try {
      const chat = new MultiAIVoiceChatExtended(config);
      chat.addEventListener(handleEvent);
      setVoiceChat(chat);
      await chat.connect();
      setParticipants(chat.getParticipants());
    } catch (err) {
      console.error('Connection error:', err);
      setError(`Failed to connect: ${err}`);
      setIsConnecting(false);
    }
  }, [enabledProviders, apiKeys, voices, systemPrompt, handleEvent]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (voiceChat) {
      voiceChat.disconnect();
      setVoiceChat(null);
    }
    setIsConnected(false);
    setParticipants([]);
    setHistory([]);
    setAudioLevels({});
  }, [voiceChat]);

  // Send text message
  const sendMessage = useCallback(() => {
    if (voiceChat && textInput.trim()) {
      voiceChat.sendTextMessage(textInput);
      setTextInput('');
    }
  }, [voiceChat, textInput]);

  // Toggle cross-feed
  const toggleCrossFeed = useCallback(() => {
    if (voiceChat) {
      const newValue = !crossFeed;
      voiceChat.setCrossFeedEnabled(newValue);
      setCrossFeed(newValue);
    }
  }, [voiceChat, crossFeed]);

  // Interrupt all
  const interruptAll = useCallback(() => {
    if (voiceChat) {
      voiceChat.interruptAll();
    }
  }, [voiceChat]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎙️ Multi-AI Voice Chat</h1>
        <p style={styles.subtitle}>Have a voice conversation with multiple AI models simultaneously</p>
      </header>

      {error && (
        <div style={styles.error}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
        </div>
      )}

      {/* Camera Overlay Elements */}
      {isConnected && isCameraOn && (
        <>
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
            <CameraPreviewOverlay
              canvasRef={canvasRef}
              status={particleStatus}
              mode={particleMode}
              setMode={setParticleMode}
            />
          </div>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', width: '640px', height: '480px' }}
          />
        </>
      )}

      {showSettings && !isConnected && (
        <div style={styles.settingsPanel}>
          <h2 style={styles.sectionTitle}>Configuration</h2>

          <div style={styles.systemPromptSection}>
            <label style={styles.label}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              style={styles.textarea}
              rows={3}
            />
          </div>

          <h3 style={styles.sectionTitle}>AI Providers</h3>
          <div style={styles.providersGrid}>
            {PROVIDERS.map(provider => (
              <div key={provider.id} style={styles.providerCard}>
                <div style={styles.providerHeader}>
                  <div
                    style={{
                      ...styles.providerIcon,
                      backgroundColor: PARTICIPANT_COLORS[provider.id] || '#888',
                    }}
                  >
                    {provider.name[0]}
                  </div>
                  <div style={styles.providerInfo}>
                    <span style={styles.providerName}>{provider.name}</span>
                    <span style={styles.providerType}>
                      {provider.isRealtime ? '🎤 Voice-native' : '🔊 TTS-based'}
                    </span>
                  </div>
                  <label style={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={enabledProviders.has(provider.id)}
                      onChange={() => toggleProvider(provider.id)}
                      style={styles.checkbox}
                    />
                    <span
                      style={{
                        ...styles.toggleSlider,
                        backgroundColor: enabledProviders.has(provider.id) ? '#4CAF50' : '#ccc',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          height: '20px',
                          width: '20px',
                          left: '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          transition: '.4s',
                          borderRadius: '50%',
                          transform: enabledProviders.has(provider.id) ? 'translateX(24px)' : 'none',
                        }}
                      />
                    </span>
                  </label>
                </div>

                <input
                  type="password"
                  placeholder={`${provider.name} API Key`}
                  value={apiKeys[provider.id] || ''}
                  onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                  style={styles.apiKeyInput}
                />

                {provider.isRealtime && VOICE_OPTIONS[provider.id] && (
                  <select
                    value={voices[provider.id]}
                    onChange={(e) => setVoices(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    style={styles.voiceSelect}
                  >
                    {VOICE_OPTIONS[provider.id].map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          <div style={styles.buttonRow}>
            <button onClick={saveKeys} style={styles.secondaryButton}>
              💾 Save API Keys
            </button>
            <button
              onClick={connect}
              disabled={isConnecting || enabledProviders.size === 0}
              style={styles.primaryButton}
            >
              {isConnecting ? '⏳ Connecting...' : '🚀 Start Voice Chat'}
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div style={styles.chatContainer}>
          <div style={styles.participantsRow}>
            {participants.map(p => (
              <div
                key={p.id}
                style={{
                  ...styles.participantCard,
                  borderColor: p.color,
                  boxShadow: audioLevels[p.id] > 0.1
                    ? `0 0 20px ${p.color}`
                    : 'none',
                }}
              >
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: p.color,
                  }}
                >
                  {p.name[0]}
                </div>
                <span style={styles.participantName}>{p.name}</span>
                <div style={styles.statusIcons}>
                  {p.isConnected && <span title="Connected">✅</span>}
                  {audioLevels[p.id] > 0.1 && <span title="Speaking">🗣️</span>}
                  {p.isMuted && <span title="Muted">🔇</span>}
                </div>
                <div
                  style={{
                    ...styles.audioBar,
                    width: `${Math.min(audioLevels[p.id] || 0, 1) * 100}%`,
                    backgroundColor: p.color,
                  }}
                />
              </div>
            ))}
          </div>

          <div style={styles.controlsRow}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={styles.controlButton}
            >
              ⚙️ Settings
            </button>
            <button
              onClick={toggleCamera}
              style={{ ...styles.controlButton, color: isCameraOn ? '#f44336' : '#333' }}
            >
              {isCameraOn ? <><CameraOff size={16} style={{ marginRight: 5, verticalAlign: 'middle' }} /> Stop Cam</> : <><Camera size={16} style={{ marginRight: 5, verticalAlign: 'middle' }} /> Start Cam</>}
            </button>
            <button
              onClick={toggleCrossFeed}
              style={{
                ...styles.controlButton,
                backgroundColor: crossFeed ? '#4CAF50' : '#f44336',
              }}
            >
              {crossFeed ? '🔗 Cross-feed ON' : '🔗 Cross-feed OFF'}
            </button>
            <button onClick={interruptAll} style={styles.controlButton}>
              ✋ Interrupt All
            </button>
            <button onClick={disconnect} style={styles.dangerButton}>
              🔌 Disconnect
            </button>
          </div>

          <div style={styles.transcript}>
            {history.map(msg => (
              <div key={msg.id} style={styles.message}>
                <span
                  style={{
                    ...styles.messageSender,
                    color: participants.find(p => p.id === msg.participantId)?.color || '#888',
                  }}
                >
                  {msg.participantName}:
                </span>
                <span style={styles.messageText}>{msg.content}</span>
                <span style={styles.messageTime}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {history.length === 0 && (
              <div style={styles.emptyState}>
                🎤 Start speaking to begin the conversation...
              </div>
            )}
          </div>

          <div style={styles.inputRow}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message (or just speak)..."
              style={styles.textInput}
            />
            <button onClick={sendMessage} style={styles.sendButton}>
              📤 Send
            </button>
          </div>
        </div>
      )}

      {!isConnected && !showSettings && (
        <button
          onClick={() => setShowSettings(true)}
          style={styles.primaryButton}
        >
          ⚙️ Configure & Start
        </button>
      )}

      {/* Visualizer Background */}
      {isConnected && voiceChat && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1, // Behind everything
          background: '#000',
        }}>
          <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
            <color attach="background" args={['#000000']} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <ambientLight intensity={isCameraOn ? 2.0 : 0.5} />

            {isCameraOn ? (
              <FaceHandParticles
                videoElement={videoRef.current}
                isCameraOn={isCameraOn}
                canvasRef={canvasRef}
                mode={particleMode}
                setStatus={setParticleStatus}
              />
            ) : (
              (() => {
                // Determine dominant speaker color
                let dominantId = 'user';
                let maxLevel = 0;

                // Check all participants
                Object.entries(audioLevels).forEach(([id, level]) => {
                  if (level > maxLevel) {
                    maxLevel = level;
                    dominantId = id;
                  }
                });

                // Get color for dominant speaker
                const p = participants.find(p => p.id === dominantId);
                const color = maxLevel > 0.05 ? (p?.color || '#4CAF50') : undefined; // Only override if actually speaking

                // Check if voiceChat has getAudioAnalyser
                const analyser = (voiceChat as any).getAudioAnalyser ? (voiceChat as any).getAudioAnalyser() : null;

                return (
                  <ShapeCloud
                    selectedColor={{ id: 'user', value: 0x4CAF50, label: 'User' }} // Default fallback
                    analyser={analyser}
                    overrideColor={color}
                  />
                );
              })()
            )}
            {/* @ts-ignore */}
            <OrbitControls autoRotate={!isCameraOn} autoRotateSpeed={0.5} enableZoom={true} />
          </Canvas>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '2.5rem',
    margin: '0 0 10px 0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: '#666',
    margin: 0,
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px 20px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#c62828',
  },
  settingsPanel: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    marginBottom: '16px',
    color: '#333',
  },
  systemPromptSection: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    color: '#555',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  providersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  providerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e9ecef',
  },
  providerHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
  },
  providerIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '18px',
  },
  providerInfo: {
    flex: 1,
    marginLeft: '12px',
    display: 'flex',
    flexDirection: 'column',
  },
  providerName: {
    fontWeight: '600',
    color: '#333',
  },
  providerType: {
    fontSize: '12px',
    color: '#666',
  },
  toggle: {
    position: 'relative',
    display: 'inline-block',
    width: '50px',
    height: '26px',
  },
  checkbox: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ccc',
    transition: '0.3s',
    borderRadius: '26px',
  },
  apiKeyInput: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '13px',
    marginBottom: '8px',
    boxSizing: 'border-box',
  },
  voiceSelect: {
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '13px',
    backgroundColor: '#fff',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  primaryButton: {
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    color: '#667eea',
    border: '2px solid #667eea',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  chatContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  participantsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px',
    justifyContent: 'center',
  },
  participantCard: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    padding: '16px',
    border: '3px solid',
    minWidth: '120px',
    textAlign: 'center',
    transition: 'box-shadow 0.2s',
    overflow: 'hidden',
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '20px',
    margin: '0 auto 8px auto',
  },
  participantName: {
    display: 'block',
    fontWeight: '600',
    color: '#333',
  },
  statusIcons: {
    fontSize: '14px',
    marginTop: '4px',
  },
  audioBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '4px',
    transition: 'width 0.1s',
  },
  controlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '20px',
    justifyContent: 'center',
  },
  controlButton: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #ddd',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dangerButton: {
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  transcript: {
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    padding: '20px',
    minHeight: '300px',
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '20px',
  },
  message: {
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  messageSender: {
    fontWeight: '600',
    marginRight: '8px',
  },
  messageText: {
    color: '#333',
  },
  messageTime: {
    color: '#999',
    fontSize: '12px',
    marginLeft: '8px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontSize: '18px',
  },
  inputRow: {
    display: 'flex',
    gap: '12px',
  },
  textInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  sendButton: {
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default VoiceChatDemo;
