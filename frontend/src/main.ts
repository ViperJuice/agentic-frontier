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

// Get scene reference (wait for scene to be ready)
let hexScene: HexWorldScene | null = null;
game.events.once('ready', () => {
  hexScene = game.scene.getScene('HexWorld') as HexWorldScene;
  console.log('[Main] HexWorldScene ready');

  // Load initial state from backend
  loadInitialState();
});

// Handle window resize
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// ==================== LOAD INITIAL DATA ====================

async function loadInitialState() {
  try {
    console.log('[Main] Loading initial state from backend...');

    // Fetch files and structures from backend
    const response = await fetch(`${API_URL}/api/status`);
    const statusData = await response.json();

    console.log('[Main] Status data:', statusData);

    // If we have files in the database, load them
    if (statusData.stats?.files > 0) {
      await loadFilesAndStructures();
    }

  } catch (error) {
    console.error('[Main] Failed to load initial state:', error);
  }
}

async function loadFilesAndStructures() {
  try {
    // Fetch files from Supabase
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*');

    if (filesError) {
      console.error('[Main] Error loading files:', filesError);
      return;
    }

    // Fetch code structures from Supabase
    const { data: structures, error: structuresError } = await supabase
      .from('code_structures')
      .select('*');

    if (structuresError) {
      console.error('[Main] Error loading structures:', structuresError);
    }

    // Pass to scene
    if (hexScene && files) {
      await hexScene.loadInitialState(files, structures || []);
      console.log(`[Main] Loaded ${files.length} files and ${structures?.length || 0} structures`);

      // Update UI stats
      updateUIStats();
    }

  } catch (error) {
    console.error('[Main] Error loading files and structures:', error);
  }
}

// ==================== SSE CONNECTION ====================

async function connectToBackend() {
  try {
    const eventSource = new EventSource(`${API_URL}/api/events/stream`);

    eventSource.onopen = () => {
      console.log('[Main] Connected to backend SSE stream');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[Main] Received SSE event:', data.type);

      // Handle different event types
      if (data.type === 'activity') {
        handleActivityEvent(data);
      } else if (data.type === 'structures_updated') {
        handleStructureUpdate(data);
      } else if (data.type === 'subagent_spawned') {
        handleSubagentSpawned(data);
      } else if (data.type === 'dependency_added') {
        handleDependencyAdded(data);
      }

      // Update UI stats after any event
      updateUIStats();
    };

    eventSource.onerror = (error) => {
      console.error('[Main] SSE connection error:', error);
      // Reconnect after 5 seconds
      setTimeout(connectToBackend, 5000);
    };
  } catch (error) {
    console.error('[Main] Failed to connect to backend:', error);
    setTimeout(connectToBackend, 5000);
  }
}

// ==================== EVENT HANDLERS ====================

function handleActivityEvent(data: any) {
  if (!hexScene || !hexScene.scene.isActive()) {
    console.warn('[Main] Scene not ready for activity event');
    return;
  }

  // Pass event to scene
  hexScene.onActivityEvent({
    sessionId: data.sessionId,
    activity: data.activity,
    agentType: data.agentType || determineAgentTypeFromActivity(data.activity)
  });

  // Update activity feed in UI
  updateActivityFeed(data.activity);
}

function handleStructureUpdate(data: any) {
  if (!hexScene || !hexScene.scene.isActive()) {
    console.warn('[Main] Scene not ready for structure update');
    return;
  }

  hexScene.onStructureUpdate(data);
}

function handleSubagentSpawned(data: any) {
  if (!hexScene || !hexScene.scene.isActive()) {
    console.warn('[Main] Scene not ready for subagent spawn');
    return;
  }

  // Create agent in scene
  hexScene.onActivityEvent({
    sessionId: data.data.session_id,
    agentType: data.data.sprite_type || 'scout',
    activity: {
      category: 'lifecycle',
      action: 'spawned',
      icon: '✨',
      details: {}
    }
  });
}

function handleDependencyAdded(data: any) {
  if (!hexScene || !hexScene.scene.isActive()) {
    console.warn('[Main] Scene not ready for dependency');
    return;
  }

  const { sourceFileId, targetFileId, strength, color } = data;
  hexScene.drawDependency(sourceFileId, targetFileId, strength || 1, color || '#3498db');
}

function determineAgentTypeFromActivity(activity: any): string {
  if (!activity) return 'scout';

  const action = activity.action?.toLowerCase() || '';
  const category = activity.category?.toLowerCase() || '';

  // Determine agent type based on activity
  if (action.includes('search') || action.includes('find') || action.includes('explore')) {
    return 'scout';
  } else if (action.includes('create') || action.includes('write') || action.includes('implement')) {
    return 'builder';
  } else if (action.includes('fix') || action.includes('debug') || action.includes('refactor')) {
    return 'warrior';
  } else if (action.includes('setup') || action.includes('configure') || action.includes('install')) {
    return 'settler';
  }

  // Default based on category
  if (category === 'exploration') return 'scout';
  if (category === 'code') return 'builder';
  if (category === 'command') return 'warrior';
  if (category === 'lifecycle') return 'settler';

  return 'scout'; // Default
}

// ==================== UI UPDATES ====================

function updateUIStats() {
  if (!hexScene) return;

  const stats = hexScene.getSceneStats();

  // Update DOM elements (assuming they exist in index.html)
  const activeAgentsEl = document.getElementById('active-agents');
  const settlementsEl = document.getElementById('settlements');
  const structuresEl = document.getElementById('structures');
  const activitiesEl = document.getElementById('activities');

  if (activeAgentsEl) activeAgentsEl.textContent = stats.activeAgents.toString();
  if (settlementsEl) settlementsEl.textContent = stats.settlements.toString();
  if (structuresEl) structuresEl.textContent = stats.codeStructures.toString();
  if (activitiesEl) {
    // Increment activities counter
    const current = parseInt(activitiesEl.textContent || '0');
    activitiesEl.textContent = (current + 1).toString();
  }
}

function updateActivityFeed(activity: any) {
  const feedEl = document.getElementById('activity-feed');
  if (!feedEl) return;

  const item = document.createElement('div');
  item.className = 'activity-item';
  item.innerHTML = `
    <span class="activity-icon">${activity.icon || '•'}</span>
    <span class="activity-action">${activity.action}</span>
    <span class="activity-time">${new Date().toLocaleTimeString()}</span>
  `;

  // Prepend to feed
  feedEl.insertBefore(item, feedEl.firstChild);

  // Keep only last 50 activities
  while (feedEl.children.length > 50) {
    feedEl.removeChild(feedEl.lastChild!);
  }
}

// ==================== BUILDING SELECTION ====================

window.addEventListener('buildingSelected', ((event: CustomEvent) => {
  const { file, structure, type } = event.detail;

  console.log('[Main] Building selected:', { file, structure, type });

  // Update detail panel in UI
  const detailPanel = document.getElementById('detail-panel');
  if (detailPanel) {
    if (type === 'structure') {
      detailPanel.innerHTML = `
        <h3>${structure.name}</h3>
        <p><strong>Type:</strong> ${structure.type}</p>
        <p><strong>Lines:</strong> ${structure.start_line} - ${structure.end_line}</p>
        ${structure.visibility ? `<p><strong>Visibility:</strong> ${structure.visibility}</p>` : ''}
        ${structure.return_type ? `<p><strong>Returns:</strong> ${structure.return_type}</p>` : ''}
      `;
    } else if (type === 'file') {
      detailPanel.innerHTML = `
        <h3>${file.name}</h3>
        <p><strong>Path:</strong> ${file.path}</p>
        <p><strong>Type:</strong> ${file.building_type || 'unknown'}</p>
        <p><strong>Structures:</strong> ${file.structure_count || 0}</p>
        <p><strong>Lines:</strong> ${file.lines_count || 'unknown'}</p>
      `;
    }
    detailPanel.style.display = 'block';
  }
}) as EventListener);

// Connect to backend when page loads
connectToBackend();

// Export for debugging
(window as any).game = game;
(window as any).supabase = supabase;
(window as any).qualitySettings = qualitySettings;