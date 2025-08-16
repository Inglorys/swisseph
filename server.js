const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swiss Ephemeris library binding
const swisseph = ffi.Library(path.join(__dirname, 'src', 'libswe.so'), {
  'swe_calc_ut': ['int', ['double', 'int', 'int32', 'pointer', 'pointer']],
  'swe_houses': ['int', ['double', 'double', 'double', 'int', 'pointer', 'pointer']],
  'swe_set_ephe_path': ['void', ['string']],
  'swe_set_sid_mode': ['void', ['int', 'double', 'double']],
  'swe_julday': ['double', ['int', 'int', 'int', 'double', 'int']],
  'swe_revjul': ['void', ['double', 'int', 'pointer', 'pointer', 'pointer', 'pointer']],
  'swe_get_ayanamsa_ut': ['double', ['double']],
  'swe_close': ['void', []]
});

// Set ephemeris path
swisseph.swe_set_ephe_path(path.join(__dirname, 'ephe'));

// Set Lahiri ayanamsa for Vedic astrology
swisseph.swe_set_sid_mode(1, 0, 0); // SE_SIDM_LAHIRI = 1

// Planet constants
const PLANETS = {
  SUN: 0, MOON: 1, MERCURY: 2, VENUS: 3, MARS: 4,
  JUPITER: 5, SATURN: 6, URANUS: 7, NEPTUNE: 8, PLUTO: 9,
  MEAN_NODE: 10, TRUE_NODE: 11, MEAN_APOG: 12, OSCUL_APOG: 13,
  EARTH: 14, CHIRON: 15
};

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

// Helper functions
function julianDay(year, month, day, hour, minute = 0) {
  const decimalHour = hour + minute / 60.0;
  return swisseph.swe_julday(year, month, day, decimalHour, 1); // 1 = Gregorian calendar
}

function degreeToSign(degree) {
  const signIndex = Math.floor(degree / 30);
  const signDegree = degree % 30;
  const degrees = Math.floor(signDegree);
  const minutes = Math.floor((signDegree - degrees) * 60);
  
  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree: degrees,
    minute: minutes,
    total_degree: degree,
    formatted: `${ZODIAC_SIGNS[signIndex]} ${degrees}°${minutes.toString().padStart(2, '0')}'`
  };
}

function degreeToNakshatra(degree) {
  const nakshatraIndex = Math.floor(degree / (360 / 27));
  const nakshatraDegree = degree % (360 / 27);
  const pada = Math.floor(nakshatraDegree / (360 / 27 / 4)) + 1;
  
  return {
    name: NAKSHATRAS[nakshatraIndex],
    pada: pada,
    degree: nakshatraDegree
  };
}

function calculatePlanet(julianDay, planetId) {
  const xx = Buffer.alloc(6 * 8); // 6 doubles for coordinates
  const serr = Buffer.alloc(256); // Error string buffer
  
  const flag = 2048 + 256; // SEFLG_SWIEPH + SEFLG_SIDEREAL
  const result = swisseph.swe_calc_ut(julianDay, planetId, flag, xx, serr);
  
  if (result < 0) {
    throw new Error(`Swiss Ephemeris error: ${serr.toString()}`);
  }
  
  const longitude = xx.readDoubleLE(0);
  const latitude = xx.readDoubleLE(8);
  const distance = xx.readDoubleLE(16);
  const speedLon = xx.readDoubleLE(24);
  
  return {
    longitude: longitude,
    latitude: latitude,
    distance: distance,
    speed: speedLon,
    retrograde: speedLon < 0,
    sign: degreeToSign(longitude),
    nakshatra: degreeToNakshatra(longitude)
  };
}

function calculateAscendant(julianDay, latitude, longitude) {
  const cusps = Buffer.alloc(13 * 8); // 13 house cusps
  const ascmc = Buffer.alloc(10 * 8); // Ascendant, MC, etc.
  
  const hsys = 87; // 'W' = Whole Sign houses (ASCII 87)
  const result = swisseph.swe_houses(julianDay, latitude, longitude, hsys, cusps, ascmc);
  
  if (result < 0) {
    throw new Error('Failed to calculate houses');
  }
  
  const ascendant = ascmc.readDoubleLE(0);
  const mc = ascmc.readDoubleLE(8);
  
  return {
    ascendant: {
      longitude: ascendant,
      sign: degreeToSign(ascendant),
      nakshatra: degreeToNakshatra(ascendant)
    },
    mc: {
      longitude: mc,
      sign: degreeToSign(mc)
    }
  };
}

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Swiss Ephemeris API for Vedic Astrology',
    version: '1.0.0',
    endpoints: {
      '/calculate': 'POST - Calculate planetary positions',
      '/planets': 'GET - Get current planetary positions',
      '/health': 'GET - Health check'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/calculate', async (req, res) => {
  try {
    const { date, time, latitude, longitude, timezone = 0 } = req.body;
    
    if (!date || !time || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: date, time, latitude, longitude'
      });
    }
    
    // Parse date and time
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    
    // Convert to UTC
    const utcHour = hour - timezone;
    const jd = julianDay(year, month, day, utcHour, minute);
    
    // Calculate ayanamsa
    const ayanamsa = swisseph.swe_get_ayanamsa_ut(jd);
    
    // Calculate planets
    const planets = {};
    const planetNames = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
    const planetIds = [PLANETS.SUN, PLANETS.MOON, PLANETS.MERCURY, PLANETS.VENUS, 
                      PLANETS.MARS, PLANETS.JUPITER, PLANETS.SATURN, PLANETS.TRUE_NODE];
    
    for (let i = 0; i < planetNames.length - 1; i++) {
      planets[planetNames[i]] = calculatePlanet(jd, planetIds[i]);
    }
    
    // Calculate Ketu (opposite of Rahu)
    const rahuLon = planets.Rahu.longitude;
    const ketuLon = (rahuLon + 180) % 360;
    planets.Ketu = {
      longitude: ketuLon,
      sign: degreeToSign(ketuLon),
      nakshatra: degreeToNakshatra(ketuLon),
      retrograde: true
    };
    
    // Calculate Ascendant and houses
    const houses = calculateAscendant(jd, latitude, longitude);
    
    const result = {
      input: {
        date,
        time,
        latitude,
        longitude,
        timezone,
        julian_day: jd
      },
      ayanamsa: Math.round(ayanamsa * 10000) / 10000,
      planets,
      houses,
      calculation_time: new Date().toISOString()
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ 
      error: 'Calculation failed', 
      message: error.message 
    });
  }
});

app.get('/planets', (req, res) => {
  try {
    const now = new Date();
    const jd = julianDay(now.getFullYear(), now.getMonth() + 1, now.getDate(), 
                        now.getHours(), now.getMinutes());
    
    const planets = {};
    const planetNames = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    const planetIds = [PLANETS.SUN, PLANETS.MOON, PLANETS.MERCURY, PLANETS.VENUS, 
                      PLANETS.MARS, PLANETS.JUPITER, PLANETS.SATURN];
    
    for (let i = 0; i < planetNames.length; i++) {
      planets[planetNames[i]] = calculatePlanet(jd, planetIds[i]);
    }
    
    res.json({
      timestamp: now.toISOString(),
      julian_day: jd,
      planets
    });
    
  } catch (error) {
    console.error('Current planets error:', error);
    res.status(500).json({ 
      error: 'Failed to get current planets',
      message: error.message 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Swiss Ephemeris API listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down Swiss Ephemeris API...');
  swisseph.swe_close();
  process.exit(0);
});
