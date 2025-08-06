// Enhanced Phaser.js Frontend with Code Structure Visualization
// File: frontend/src/main.ts

import Phaser from 'phaser';
import { createClient } from '@supabase/supabase-js';
import HexWorldScene from './scenes/hexworldscene';
import { detectDeviceCapability, QualitySettings } from './utils/device-detect';

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Detect device capabilities
const deviceInfo = detectDeviceCapability();
const qualitySettings = new QualitySettings({
  ...deviceInfo.getQualityPreset(),
  qualityTier: deviceInfo.qualityTier
});

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: HexWorldScene,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: false,
    antialias: deviceInfo.qualityTier !== 'low'
  }
};

// Create game
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// Set up SSE connection for real-time updates
async function connectToBackend() {
  try {
    const eventSource = new EventSource(`${API_URL}/api/events/stream`);
    
    eventSource.onopen = () => {
      console.log('Connected to backend SSE stream');
    };
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received event:', data);
      
      // Handle different event types
      if (data.type === 'activity') {
        handleActivityEvent(data);
      } else if (data.type === 'structures_updated') {
        handleStructureUpdate(data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Reconnect after 5 seconds
      setTimeout(connectToBackend, 5000);
    };
  } catch (error) {
    console.error('Failed to connect to backend:', error);
    setTimeout(connectToBackend, 5000);
  }
}

// Handle activity events
function handleActivityEvent(data: any) {
  // This will be used to update the visualization
  // For now, just log it
  console.log('Activity:', data.activity);
}

// Handle structure updates
function handleStructureUpdate(data: any) {
  // This will be used to update building structures
  console.log('Structure update for file:', data.file_path);
}

// Connect to backend when page loads
connectToBackend();

// Export for debugging
(window as any).game = game;
(window as any).supabase = supabase;
(window as any).qualitySettings = qualitySettings;