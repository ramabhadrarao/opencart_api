// utils/geoLocationService.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service for IP geolocation using free APIs
 * Supports multiple providers with fallback mechanism
 */
class GeoLocationService {
  constructor() {
    // Cache to prevent repeated API calls for the same IP
    this.cache = new Map();
    this.cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get location data from IP address
   * @param {string} ip - IP address to lookup
   * @returns {Promise<Object>} - Location data
   */
  async getLocationFromIp(ip) {
    // Skip lookup for localhost/private IPs
    if (this.isPrivateIP(ip) || ip === '127.0.0.1' || ip === '::1') {
      return this.getDefaultLocation();
    }

    // Check cache first
    const cacheKey = `ip:${ip}`;
    const cachedData = this.getFromCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Try different free geolocation APIs with fallback
    try {
      // First try ip-api.com (free tier, no API key required, 45 req/min limit)
      const location = await this.getLocationFromIpApi(ip);
      this.saveToCache(cacheKey, location);
      return location;
    } catch (error) {
      console.error('Error with ip-api.com, trying fallback:', error.message);
      
      try {
        // Fallback to ipinfo.io (free tier, limited requests)
        const location = await this.getLocationFromIpInfo(ip);
        this.saveToCache(cacheKey, location);
        return location;
      } catch (error) {
        console.error('Error with ipinfo.io, trying last fallback:', error.message);
        
        try {
          // Last fallback to ipgeolocation.io
          const location = await this.getLocationFromIpGeoLocation(ip);
          this.saveToCache(cacheKey, location);
          return location;
        } catch (error) {
          console.error('All geolocation attempts failed:', error.message);
          return this.getDefaultLocation();
        }
      }
    }
  }

  /**
   * Get location from ip-api.com
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Location data
   */
  async getLocationFromIpApi(ip) {
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,timezone,isp,query`);
    
    if (response.data.status !== 'success') {
      throw new Error(response.data.message || 'IP API request failed');
    }
    
    return {
      ip: response.data.query,
      country: response.data.country,
      region: response.data.regionName,
      city: response.data.city,
      latitude: response.data.lat,
      longitude: response.data.lon,
      timezone: response.data.timezone,
      isp: response.data.isp
    };
  }

  /**
   * Get location from ipinfo.io
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Location data
   */
  async getLocationFromIpInfo(ip) {
    const token = process.env.IPINFO_TOKEN || ''; // Optional token for higher limits
    const url = token ? `https://ipinfo.io/${ip}?token=${token}` : `https://ipinfo.io/${ip}/json`;
    
    const response = await axios.get(url);
    
    // Parse location data if available (in format "lat,lon")
    let latitude = null;
    let longitude = null;
    
    if (response.data.loc) {
      const [lat, lon] = response.data.loc.split(',');
      latitude = parseFloat(lat);
      longitude = parseFloat(lon);
    }
    
    return {
      ip: ip,
      country: response.data.country,
      region: response.data.region,
      city: response.data.city,
      latitude,
      longitude,
      timezone: response.data.timezone,
      isp: response.data.org
    };
  }

  /**
   * Get location from ipgeolocation.io
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Location data
   */
  async getLocationFromIpGeoLocation(ip) {
    const apiKey = process.env.IPGEOLOCATION_API_KEY || '';
    const url = `https://api.ipgeolocation.io/ipgeo?ip=${ip}${apiKey ? `&apiKey=${apiKey}` : ''}`;
    
    const response = await axios.get(url);
    
    return {
      ip: response.data.ip,
      country: response.data.country_name,
      region: response.data.state_prov,
      city: response.data.city,
      latitude: parseFloat(response.data.latitude),
      longitude: parseFloat(response.data.longitude),
      timezone: response.data.time_zone?.name,
      isp: response.data.isp
    };
  }

  /**
   * Get default location when lookup fails
   * @returns {Object} - Default location data
   */
  getDefaultLocation() {
    return {
      ip: 'unknown',
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null,
      timezone: null,
      isp: 'Unknown'
    };
  }

  /**
   * Save data to cache
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  saveToCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get data from cache if not expired
   * @param {string} key - Cache key
   * @returns {Object|null} - Cached data or null if expired/not found
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check if cache has expired
    if (Date.now() - cached.timestamp > this.cacheExpiryMs) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Check if IP is a private/local network address
   * @param {string} ip - IP address to check
   * @returns {boolean} - True if private IP
   */
  isPrivateIP(ip) {
    // Check IPv4 private ranges
    if (ip.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|0\.)/)) {
      return true;
    }
    
    // Check IPv6 private ranges (simplified check)
    if (ip.match(/^(::1|fe80::|fc00::|fd00::|ff00::)/i)) {
      return true;
    }
    
    return false;
  }
}

// Export as singleton instance
export default new GeoLocationService();