// Offline IP → approximate location lookup (city/region/country), used so
// admin can see roughly *where* a user logged in from, alongside the IP
// itself. Uses geoip-lite's bundled database — no external API calls, no
// network dependency, and no extra latency on login.
let geoip;
try { geoip = require('geoip-lite'); } catch { geoip = null; }

function cleanIp(ip) {
  if (!ip) return '';
  // Strip IPv6-mapped-IPv4 prefix, and take the first hop if a list was
  // passed via X-Forwarded-For ("client, proxy1, proxy2").
  return ip.split(',')[0].trim().replace(/^::ffff:/, '');
}

function locateIp(ip) {
  const clean = cleanIp(ip);
  if (!clean || !geoip) return { ip: clean, city: '', region: '', country: '', label: 'Unknown' };

  // Loopback / private network — common in local dev, can't be geolocated
  if (['127.0.0.1', '::1'].includes(clean) || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(clean)) {
    return { ip: clean, city: '', region: '', country: '', label: 'Local network' };
  }

  const geo = geoip.lookup(clean);
  if (!geo) return { ip: clean, city: '', region: '', country: '', label: 'Unknown location' };

  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return {
    ip: clean,
    city: geo.city || '',
    region: geo.region || '',
    country: geo.country || '',
    ll: geo.ll || null,
    label: parts.join(', ') || 'Unknown location',
  };
}

module.exports = { locateIp, cleanIp };
