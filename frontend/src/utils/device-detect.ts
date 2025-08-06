// Device capability detection for performance optimization

export interface QualityPreset {
  maxSprites: number;
  enableFog: boolean;
  enableAnimations: boolean;
  enable3DSprites: boolean | 'selective';
  tileScale: number;
  particleLimit?: number;
}

export interface DeviceInfo {
  // Device type
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isRaspberryPi: boolean;
  isDesktop: boolean;
  
  // Hardware
  cores: number;
  memory: number;
  webglTier: 'low' | 'medium' | 'high';
  
  // Quality settings
  qualityTier: 'low' | 'medium' | 'high';
  maxSprites: number;
  enableFog: boolean;
  enableAnimations: boolean;
  enable3DSprites: boolean | 'selective';
  
  // Specific settings
  tileScale: number;
  maxZoom: number;
  minZoom: number;
  cameraSmoothing: boolean;
  
  // Helper method to get quality preset
  getQualityPreset(): QualityPreset;
}

export function detectDeviceCapability(): DeviceInfo {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  
  // Detect device type
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  
  // Detect Raspberry Pi (usually reports as Linux armv7l or aarch64)
  const isRaspberryPi = /Linux arm/i.test(platform) || 
                        (platform === 'Linux aarch64') ||
                        (ua.includes('Raspbian'));
  
  // Check hardware capabilities
  const cores = navigator.hardwareConcurrency || 1;
  const memory = (navigator as any).deviceMemory || 0; // In GB, Chrome only
  
  // Check WebGL capabilities
  let webglTier: 'low' | 'medium' | 'high' = 'low';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // Check for powerful GPUs
        if (/NVIDIA|AMD|Radeon|GeForce/i.test(renderer)) {
          webglTier = 'high';
        } else if (/Intel|Mali|Adreno/i.test(renderer)) {
          webglTier = 'medium';
        }
      }
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (maxTextureSize < 4096) {
        webglTier = 'low';
      }
    }
  } catch (e) {
    console.warn('WebGL detection failed:', e);
  }
  
  // Determine quality tier
  let qualityTier: 'low' | 'medium' | 'high' = 'high';
  let maxSprites = 500;
  let enableFog = true;
  let enableAnimations = true;
  let enable3DSprites: boolean | 'selective' = true;
  
  if (isRaspberryPi) {
    // Raspberry Pi gets lowest settings
    qualityTier = 'low';
    maxSprites = 50;
    enableFog = false;
    enableAnimations = false;
    enable3DSprites = false;
  } else if (isMobile) {
    if (cores <= 2 || memory <= 2 || webglTier === 'low') {
      // Low-end mobile
      qualityTier = 'low';
      maxSprites = 100;
      enableFog = true;
      enableAnimations = false;
      enable3DSprites = false;
    } else if (cores <= 4 || memory <= 4) {
      // Mid-range mobile
      qualityTier = 'medium';
      maxSprites = 200;
      enableFog = true;
      enableAnimations = true;
      enable3DSprites = 'selective'; // Only important features
    } else {
      // High-end mobile
      qualityTier = 'high';
      maxSprites = 300;
      enableFog = true;
      enableAnimations = true;
      enable3DSprites = true;
    }
  } else {
    // Desktop
    if (cores <= 2 || webglTier === 'low') {
      qualityTier = 'medium';
      maxSprites = 300;
    } else {
      qualityTier = 'high';
      maxSprites = 500;
    }
    enableFog = true;
    enableAnimations = true;
    enable3DSprites = true;
  }
  
  // Allow URL parameter override for testing
  const urlParams = new URLSearchParams(window.location.search);
  const forceQuality = urlParams.get('quality');
  if (forceQuality && ['low', 'medium', 'high'].includes(forceQuality)) {
    qualityTier = forceQuality as 'low' | 'medium' | 'high';
    console.log(`Quality tier overridden to: ${forceQuality}`);
  }
  
  const deviceInfo: DeviceInfo = {
    // Device type
    isMobile,
    isTablet,
    isIOS,
    isAndroid,
    isRaspberryPi,
    isDesktop: !isMobile && !isTablet && !isRaspberryPi,
    
    // Hardware
    cores,
    memory,
    webglTier,
    
    // Quality settings
    qualityTier,
    maxSprites,
    enableFog,
    enableAnimations,
    enable3DSprites,
    
    // Specific settings
    tileScale: qualityTier === 'low' ? 0.25 : qualityTier === 'medium' ? 0.375 : 0.5,
    maxZoom: qualityTier === 'low' ? 1.5 : 2.0,
    minZoom: qualityTier === 'low' ? 0.75 : 0.5,
    cameraSmoothing: qualityTier !== 'low',
    
    // Helper method to get quality preset
    getQualityPreset(): QualityPreset {
      const presets: Record<string, QualityPreset> = {
        low: {
          maxSprites: 50,
          enableFog: false,
          enableAnimations: false,
          enable3DSprites: false,
          tileScale: 0.25,
          particleLimit: 0
        },
        medium: {
          maxSprites: 200,
          enableFog: true,
          enableAnimations: true,
          enable3DSprites: 'selective',
          tileScale: 0.375,
          particleLimit: 50
        },
        high: {
          maxSprites: 500,
          enableFog: true,
          enableAnimations: true,
          enable3DSprites: true,
          tileScale: 0.5,
          particleLimit: 100
        }
      };
      return presets[this.qualityTier];
    }
  };
  
  console.log('Device Detection Results:', {
    type: isMobile ? 'Mobile' : isTablet ? 'Tablet' : isRaspberryPi ? 'Raspberry Pi' : 'Desktop',
    cores,
    memory: memory ? `${memory}GB` : 'Unknown',
    webGL: webglTier,
    quality: qualityTier,
    sprites: maxSprites
  });
  
  return deviceInfo;
}

// Quality settings that can be adjusted at runtime
export class QualitySettings {
  private settings: QualityPreset & { qualityTier: string };
  private listeners: Array<(settings: QualityPreset & { qualityTier: string }) => void> = [];

  constructor(initialSettings: QualityPreset & { qualityTier: string }) {
    this.settings = initialSettings;
  }
  
  setQuality(tier: 'low' | 'medium' | 'high'): void {
    const presets: Record<string, QualityPreset> = {
      low: {
        maxSprites: 50,
        enableFog: false,
        enableAnimations: false,
        enable3DSprites: false,
        tileScale: 0.25
      },
      medium: {
        maxSprites: 200,
        enableFog: true,
        enableAnimations: true,
        enable3DSprites: 'selective',
        tileScale: 0.375
      },
      high: {
        maxSprites: 500,
        enableFog: true,
        enableAnimations: true,
        enable3DSprites: true,
        tileScale: 0.5
      }
    };
    
    if (presets[tier]) {
      Object.assign(this.settings, presets[tier]);
      this.settings.qualityTier = tier;
      this.notifyListeners();
    }
  }
  
  onChange(callback: (settings: QualityPreset & { qualityTier: string }) => void): void {
    this.listeners.push(callback);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.settings));
  }
}