export class NetworkAnalyzer {
  constructor() {
    this.quality = 'unknown';
    this.speed = 0; // Mbps
    this.type = 'unknown';
    this.effectiveType = 'unknown';
  }

  async analyze() {
    // Use Network Information API if available
    if ('connection' in navigator) {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      this.effectiveType = conn.effectiveType || 'unknown'; // '4g', '3g', '2g', 'slow-2g'
      this.type = conn.type || 'unknown';

      // Estimate speed based on effective type
      const speedMap = {
        'slow-2g': 0.05,
        '2g': 0.25,
        '3g': 1.5,
        '4g': 10
      };
      this.speed = speedMap[this.effectiveType] || 5;
    } else {
      // Fallback: measure actual download speed
      await this.measureSpeed();
    }

    this.determineQuality();
    return this.getStatus();
  }

  async measureSpeed() {
    const testUrl = 'https://archive.org/services/img/nasa'; // small image
    const startTime = Date.now();

    try {
      const response = await fetch(testUrl, { cache: 'no-store' });
      const blob = await response.blob();
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const sizeInBits = blob.size * 8;
      this.speed = (sizeInBits / duration / 1000000).toFixed(2); // Mbps
    } catch (err) {
      console.warn('Network speed test failed:', err);
      this.speed = 1; // assume slow
    }
  }

  determineQuality() {
    if (this.speed >= 5) {
      this.quality = 'fast';
    } else if (this.speed >= 1) {
      this.quality = 'medium';
    } else {
      this.quality = 'slow';
    }
  }

  getStatus() {
    return {
      quality: this.quality,
      speed: this.speed,
      type: this.type,
      effectiveType: this.effectiveType,
      icon: this.quality === 'fast' ? '🟢' : this.quality === 'medium' ? '🟡' : '🔴',
      label: this.quality === 'fast' ? 'Fast' : this.quality === 'medium' ? 'Medium' : 'Slow',
      recommendation: this.getRecommendation()
    };
  }

  getRecommendation() {
    if (this.quality === 'fast') return 'High quality recommended';
    if (this.quality === 'medium') return 'Medium quality recommended';
    return 'Low quality recommended to avoid buffering';
  }
}
