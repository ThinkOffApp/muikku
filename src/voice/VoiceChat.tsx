/**
 * Voice Chat UI Component
 * Visual interface for multi-AI voice conversations
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVoiceChat } from './useVoiceChat';
import { type Participant, type ConversationMessage } from './types';

interface VoiceChatProps {
  openAiApiKey?: string;
  geminiApiKey?: string;
  onClose?: () => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({
  openAiApiKey,
  geminiApiKey,
  onClose,
}) => {
  const [textInput, setTextInput] = useState('');
  const [crossFeedEnabled, setCrossFeedEnabledLocal] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isConnecting,
    error,
    participants,
    conversationHistory,
    audioLevels,
    connect,
    disconnect,
    sendMessage,
    interruptAll,
    setParticipantMuted,
    setCrossFeedEnabled,
  } = useVoiceChat({
    openAiApiKey,
    geminiApiKey,
    systemPrompt: 'You are participating in a multi-AI voice conversation. Be concise, conversational, and engaging. You may hear other AI participants - respond to them naturally and feel free to agree, disagree, or build on their points.',
  });

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendMessage(textInput.trim());
      setTextInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleCrossFeed = () => {
    const newValue = !crossFeedEnabled;
    setCrossFeedEnabledLocal(newValue);
    setCrossFeedEnabled(newValue);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🎙️ AI Voice Chat</h2>
        <div style={styles.headerButtons}>
          {onClose && (
            <button onClick={onClose} style={styles.closeButton}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {/* Participants visualization */}
      <div style={styles.participantsArea}>
        <div style={styles.participantsGrid}>
          {participants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              audioLevel={audioLevels.get(participant.id) || 0}
              onMuteToggle={() => setParticipantMuted(participant.id, !participant.isMuted)}
            />
          ))}

          {/* Show placeholders if not connected */}
          {!isConnected && (
            <>
              <ParticipantPlaceholder name="You" color="#4CAF50" />
              {openAiApiKey && <ParticipantPlaceholder name="GPT-4o" color="#10A37F" />}
              {geminiApiKey && <ParticipantPlaceholder name="Gemini" color="#4285F4" />}
            </>
          )}
        </div>

        {/* Connection lines visualization */}
        {isConnected && participants.length > 1 && (
          <svg style={styles.connectionLines}>
            {/* Lines showing audio connections */}
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#9C27B0" />
              </marker>
            </defs>
            {crossFeedEnabled && (
              <>
                <line x1="30%" y1="50%" x2="70%" y2="50%" stroke="#9C27B0" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
                <line x1="70%" y1="50%" x2="30%" y2="50%" stroke="#9C27B0" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
              </>
            )}
          </svg>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting || (!openAiApiKey && !geminiApiKey)}
            style={{
              ...styles.connectButton,
              opacity: isConnecting || (!openAiApiKey && !geminiApiKey) ? 0.5 : 1,
            }}
          >
            {isConnecting ? '🔄 Connecting...' : '📞 Start Voice Chat'}
          </button>
        ) : (
          <div style={styles.activeControls}>
            <button onClick={interruptAll} style={styles.controlButton} title="Interrupt all AI responses">
              ⏹️ Stop
            </button>
            <button
              onClick={toggleCrossFeed}
              style={{
                ...styles.controlButton,
                backgroundColor: crossFeedEnabled ? '#9C27B0' : '#666',
              }}
              title={crossFeedEnabled ? 'AIs can hear each other' : 'AIs cannot hear each other'}
            >
              {crossFeedEnabled ? '🔗 Cross-feed ON' : '🔓 Cross-feed OFF'}
            </button>
            <button onClick={disconnect} style={styles.endButton}>
              📵 End Call
            </button>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div style={styles.transcriptSection}>
        <h3 style={styles.transcriptTitle}>Transcript</h3>
        <div ref={transcriptRef} style={styles.transcript}>
          {conversationHistory.length === 0 ? (
            <p style={styles.transcriptPlaceholder}>
              {isConnected
                ? 'Start speaking to begin the conversation...'
                : 'Connect to start a voice chat'}
            </p>
          ) : (
            conversationHistory.map((message) => (
              <TranscriptMessage key={message.id} message={message} />
            ))
          )}
        </div>
      </div>

      {/* Text input (optional) */}
      {isConnected && (
        <div style={styles.textInputArea}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message (or just speak)..."
            style={styles.textInput}
          />
          <button onClick={handleSendText} style={styles.sendButton}>
            Send
          </button>
        </div>
      )}
    </div>
  );
};

// Participant Card Component
interface ParticipantCardProps {
  participant: Participant;
  audioLevel: number;
  onMuteToggle: () => void;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  audioLevel,
  onMuteToggle,
}) => {
  const isActive = audioLevel > 0.1;

  return (
    <div
      style={{
        ...styles.participantCard,
        borderColor: isActive ? participant.color : 'transparent',
        boxShadow: isActive ? `0 0 20px ${participant.color}40` : 'none',
      }}
    >
      <div
        style={{
          ...styles.avatar,
          backgroundColor: participant.color,
        }}
      >
        {participant.id === 'user' ? '👤' : participant.id === 'openai' ? '🟢' : '🔵'}
      </div>
      <span style={styles.participantName}>{participant.name}</span>

      {/* Audio level indicator */}
      <div style={styles.audioLevelContainer}>
        <div
          style={{
            ...styles.audioLevel,
            width: `${Math.min(100, audioLevel * 200)}%`,
            backgroundColor: participant.color,
          }}
        />
      </div>

      {/* Status indicators */}
      <div style={styles.statusRow}>
        {participant.isSpeaking && <span style={styles.speakingIndicator}>🎤</span>}
        {participant.isConnected && <span style={styles.connectedIndicator}>●</span>}

        {participant.id !== 'user' && (
          <button
            onClick={onMuteToggle}
            style={styles.muteButton}
            title={participant.isMuted ? 'Unmute' : 'Mute'}
          >
            {participant.isMuted ? '🔇' : '🔊'}
          </button>
        )}
      </div>

      {/* Stereo position indicator */}
      <div style={styles.stereoIndicator}>
        <div
          style={{
            ...styles.stereoMarker,
            left: `${(participant.stereoPosition + 1) * 50}%`,
          }}
        />
      </div>
    </div>
  );
};

// Placeholder for unconnected state
const ParticipantPlaceholder: React.FC<{ name: string; color: string }> = ({ name, color }) => (
  <div style={{ ...styles.participantCard, opacity: 0.5 }}>
    <div style={{ ...styles.avatar, backgroundColor: color }}>
      {name === 'You' ? '👤' : name === 'GPT-4o' ? '🟢' : '🔵'}
    </div>
    <span style={styles.participantName}>{name}</span>
    <div style={styles.statusRow}>
      <span style={{ color: '#999' }}>Not connected</span>
    </div>
  </div>
);

// Transcript Message Component
const TranscriptMessage: React.FC<{ message: ConversationMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div style={{ ...styles.message, textAlign: isUser ? 'right' : 'left' }}>
      <div
        style={{
          ...styles.messageBubble,
          backgroundColor: isUser ? '#4CAF50' : '#333',
          marginLeft: isUser ? 'auto' : 0,
          marginRight: isUser ? 0 : 'auto',
        }}
      >
        <span style={styles.messageSender}>{message.participantName}</span>
        <p style={styles.messageContent}>{message.content}</p>
        <span style={styles.messageTime}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: '20px',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  error: {
    backgroundColor: '#ff5252',
    color: '#fff',
    padding: '12px 20px',
    fontSize: '14px',
  },
  participantsArea: {
    position: 'relative',
    padding: '24px',
    minHeight: '200px',
  },
  participantsGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  connectionLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  participantCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
    minWidth: '120px',
  },
  avatar: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    marginBottom: '8px',
  },
  participantName: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  audioLevelContainer: {
    width: '100%',
    height: '4px',
    backgroundColor: '#444',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  audioLevel: {
    height: '100%',
    transition: 'width 0.05s ease',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  speakingIndicator: {
    animation: 'pulse 1s infinite',
  },
  connectedIndicator: {
    color: '#4CAF50',
    fontSize: '10px',
  },
  muteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  stereoIndicator: {
    width: '100%',
    height: '2px',
    backgroundColor: '#444',
    borderRadius: '1px',
    position: 'relative',
    marginTop: '8px',
  },
  stereoMarker: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    top: '-3px',
    transform: 'translateX(-50%)',
  },
  controls: {
    padding: '16px 20px',
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
  },
  connectButton: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  activeControls: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  controlButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  endButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#ff5252',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  transcriptSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    padding: '16px 20px',
  },
  transcriptTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#999',
  },
  transcript: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: '#222',
    borderRadius: '8px',
    padding: '12px',
  },
  transcriptPlaceholder: {
    color: '#666',
    textAlign: 'center',
    margin: '20px 0',
  },
  message: {
    marginBottom: '12px',
  },
  messageBubble: {
    display: 'inline-block',
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: '12px',
  },
  messageSender: {
    fontSize: '12px',
    fontWeight: 600,
    opacity: 0.8,
    display: 'block',
    marginBottom: '4px',
  },
  messageContent: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.4,
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.6,
    display: 'block',
    marginTop: '4px',
  },
  textInputArea: {
    display: 'flex',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid #333',
  },
  textInput: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};

export default VoiceChat;
