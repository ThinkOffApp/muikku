/**
 * Voice Chat Module - Index
 * Export all voice chat related components and utilities
 * 
 * Phase 1: Realtime APIs (OpenAI Realtime, Gemini Live)
 * Phase 2: All Models with TTS/STT (Claude, Mistral, Grok, Meta, Perplexity)
 */

// Types
export * from './types';

// Realtime Clients (Phase 1)
export { OpenAIRealtimeClient } from './OpenAIRealtimeClient';
export { GeminiLiveClient } from './GeminiLiveClient';

// Text Model Client (Phase 2)
export { TextModelClient } from './TextModelClient';
export type { TextModelConfig } from './TextModelClient';

// TTS/STT Engines (Phase 2)
export { TTSEngine } from './TTSEngine';


// Audio
export { AudioRouter } from './AudioRouter';

// Orchestrators
export { MultiAIVoiceChat } from './MultiAIVoiceChat';
export type { MultiAIVoiceChatConfig } from './MultiAIVoiceChat';
export { MultiAIVoiceChatExtended } from './MultiAIVoiceChatExtended';
export type { ExtendedVoiceChatConfig } from './MultiAIVoiceChatExtended';

// React integration
export { useVoiceChat } from './useVoiceChat';
export type { UseVoiceChatState, UseVoiceChatActions, UseVoiceChatReturn } from './useVoiceChat';

// UI Components
export { VoiceChat } from './VoiceChat';
export { default as VoiceChatComponent } from './VoiceChat';
export { VoiceChatDemo } from './VoiceChatDemo';
export { default as VoiceChatDemoPage } from './VoiceChatDemo';
