const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Demo data for testing
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

// Generate demo planetary positions based on current date
function generateDemoPlanet(planetName, baseSpeed = 1) {
  // Use current date to generate consistent but changing positions
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  
  // Different planets have different "speeds" for more realistic demo
  const planetSpeeds = {
    'Sun': 1,
    'Moon': 13,
    'Mercury': 4,
    'Venus': 1.6,
    'Mars': 0.5,
    'Jupiter': 0.08,
    'Saturn': 0.03,
    'Rahu': -0.05,
    'Ketu': -0.05
  };
  
  const speed = planetSpeeds[planetName] || baseSpeed;
  const longitude = ((dayOfYear * speed) + (planetName.charCodeAt(0) * 7)) % 360;
  
  return {
    longitude: longitude,
    latitude: (Math.sin(dayOfYear * 0.1) * 5), // Small variation
    distance: 1 + Math.sin(dayOfYear * 0.05) * 0.1,
    speed: speed * (0.9 + Math.random() * 0.2), // Small random variation
    retrograde: speed < 0 || Math.random() > 0.9,
    sign: degreeToSign(longitude),
    nakshatra: degreeToNakshatra(longitude)
  };
}

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Swiss Ephemeris API for Vedic Astrology (Demo Mode)',
    version: '1.0.0',
    mode: 'DEMO - Positions based on current date with astronomical movements',
    status: 'Running',
    endpoints: {
      '/calculate': 'POST - Calculate planetary positions (demo)',
      '/planets': 'GET - Get current planetary positions (demo)',
      '/health': 'GET - Health check'
    },
    note: 'This demo generates realistic planetary movements but should not be used for actual astrological calculations.'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mode: 'demo',
    uptime: process.uptime()
  });
});

app.post('/calculate', async (req, res) => {
  try {
    const { date, time, latitude, longitude, timezone = 0 } = req.body;
    
    if (!date || !time || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: date, time, latitude, longitude',
        required_format: {
          date: 'YYYY-MM-DD',
          time: 'HH:MM',
          latitude: 'number (degrees)',
          longitude: 'number (degrees)',
          timezone: 'number (optional, hours offset from UTC)'
        }
      });
    }
    
    // Parse input date for more realistic demo
    const inputDate = new Date(`${date}T${time}:00`);
    const dayOfYear = Math.floor((inputDate - new Date(inputDate.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    // Generate demo planets based on input date
    const planets = {};
    const planetNames = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
    
    for (const planet of planetNames) {
      planets[planet] = generateDemoPlanet(planet);
    }
    
    // Demo ascendant calculation (simplified)
    const localTimeOffset = longitude / 15; // Rough time zone calculation
    const ascendantBase = (dayOfYear + localTimeOffset) * 0.98; // Slightly less than daily
    const ascendantLon = (ascendantBase % 360 + 360) % 360;
    
    const houses = {
      ascendant: {
        longitude: ascendantLon,
        sign: degreeToSign(ascendantLon),
        nakshatra: degreeToNakshatra(ascendantLon)
      },
      mc: {
        longitude: (ascendantLon + 90) % 360,
        sign: degreeToSign((ascendantLon + 90) % 360)
      }
    };
    
    // Demo Julian Day calculation
    const year = inputDate.getFullYear();
    const month = inputDate.getMonth() + 1;
    const day = inputDate.getDate();
    const hour = inputDate.getHours();
    const demoJulianDay = 2451545.0 + (year - 2000) * 365.25 + (month - 1) * 30.44 + day + hour / 24;
    
    const result = {
      input: {
        date,
        time,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timezone,
        julian_day: Math.round(demoJulianDay * 100000) / 100000
      },
      ayanamsa: 24.1267, // Current approximate Lahiri ayanamsa
      planets,
      houses,
      calculation_time: new Date().toISOString(),
      demo_mode: true,
      note: "This is demo data with realistic astronomical movements. For actual astrological use, please implement real Swiss Ephemeris library."
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
    const planets = {};
    const planetNames = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    
    for (const planet of planetNames) {
      planets[planet] = generateDemoPlanet(planet);
    }
    
    // Demo Julian Day for current time
    const now = new Date();
    const demoJulianDay = 2451545.0 + (now.getFullYear() - 2000) * 365.25 + 
                         (now.getMonth()) * 30.44 + now.getDate() + now.getHours() / 24;
    
    res.json({
      timestamp: now.toISOString(),
      julian_day: Math.round(demoJulianDay * 100000) / 100000,
      planets,
      demo_mode: true,
      note: "Current planetary positions (demo). Planets move realistically over time but are not astronomically accurate."
    });
    
  } catch (error) {
    console.error('Current planets error:', error);
    res.status(500).json({ 
      error: 'Failed to get current planets',
      message: error.message 
    });
  }
});

// Additional useful endpoints for astrology APIs
app.get('/signs', (req, res) => {
  res.json({
    zodiac_signs: ZODIAC_SIGNS.map((sign, index) => ({
      index: index,
      name: sign,
      element: ['Fire', 'Earth', 'Air', 'Water'][index % 4],
      ruling_planet: ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'][index]
    }))
  });
});

app.get('/nakshatras', (req, res) => {
  res.json({
    nakshatras: NAKSHATRAS.map((nakshatra, index) => ({
      index: index + 1,
      name: nakshatra,
      degrees: `${(index * 13.333).toFixed(2)}° - ${((index + 1) * 13.333).toFixed(2)}°`,
      ruling_planet: ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'][index % 9]
    }))
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'POST /calculate': 'Calculate chart',
      'GET /planets': 'Current planets',
      'GET /signs': 'Zodiac signs info',
      'GET /nakshatras': 'Nakshatras info'
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Swiss Ephemeris API (Demo Mode) listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Note: Running in DEMO mode - generating realistic planetary movements');
  console.log('Available endpoints:');
  console.log('  GET  / - API information');
  console.log('  GET  /health - Health check');
  console.log('  POST /calculate - Calculate astrological chart');
  console.log('  GET  /planets - Current planetary positions');
  console.log('  GET  /signs - Zodiac signs information');
  console.log('  GET  /nakshatras - Nakshatras information');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down Swiss Ephemeris API (Demo Mode)...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
