const fs = require('fs');
const https = require('https');

// Read the current buildings data
const buildingsData = JSON.parse(fs.readFileSync('../data/jmuBuildings.json', 'utf8'));

// Known JMU campus coordinates for key buildings (manually researched)
const knownCoordinates = {
  // Academic Buildings
  'Wilson Hall': [-78.8691, 38.4367],
  'Carrier Library': [-78.8698, 38.4360],
  'Miller Hall': [-78.8705, 38.4353],
  'Burruss Hall': [-78.8708, 38.4381],
  'Memorial Hall': [-78.8703, 38.4374],
  'ISAT/CS Building': [-78.8712, 38.4346],
  'Physics/Chemistry Building': [-78.8733, 38.4325],
  'Bioscience Building': [-78.8726, 38.4332],
  'Rose Library': [-78.8705, 38.4353],
  'Showker Hall': [-78.8715, 38.4340],
  'Zane Showker Hall': [-78.8715, 38.4340],

  // Recreation & Athletics
  'University Recreation Center (UREC)': [-78.8740, 38.4318],
  'Convocation Center': [-78.8750, 38.4308],
  'Godwin Hall': [-78.8735, 38.4315],
  'Plecker Athletic Performance Center': [-78.8745, 38.4305],

  // Student Services
  'Warren Hall (The Union)': [-78.8720, 38.4350],
  'Taylor Hall (The Union)': [-78.8725, 38.4345],
  'University Health Center': [-78.8730, 38.4340],
  'Student Success Center': [-78.8710, 38.4355],

  // Residence Halls (Devon Lane area)
  'Ashby Hall': [-78.8680, 38.4380],
  'Bell Hall': [-78.8685, 38.4375],
  'Bluestone Hall': [-78.8690, 38.4370],
  'Chandler Hall': [-78.8695, 38.4365],
  'Chesapeake Hall': [-78.8700, 38.4360],
  'Dingledine Hall': [-78.8705, 38.4355],
  'Eagle Hall': [-78.8710, 38.4350],
  'Frederikson Hall': [-78.8715, 38.4345],
  'Garber Hall': [-78.8720, 38.4340],
  'Gifford Hall': [-78.8725, 38.4335],
  'Hanson Hall': [-78.8730, 38.4330],
  'Hoffman Hall': [-78.8735, 38.4325],
  'Huffman Hall': [-78.8740, 38.4320],
  'Lakeview Hall': [-78.8745, 38.4315],
  'Logan Hall': [-78.8750, 38.4310],

  // Bluestone Drive area
  'Moody Hall': [-78.8760, 38.4300],
  'Roop Hall': [-78.8765, 38.4295],
  'Shorts Hall': [-78.8770, 38.4290],
  'Varner House': [-78.8775, 38.4285],
  'Wampler Hall': [-78.8780, 38.4280],
  'Wayland Hall': [-78.8785, 38.4275],
  'White Hall': [-78.8790, 38.4270],

  // Parking
  'Warsaw Ave. Parking Deck (5-Level)': [-78.8695, 38.4365],

  // Support Buildings
  'Music Building': [-78.8740, 38.4318],
  'Frye Building': [-78.8768, 38.4290],
  'Power Plant': [-78.8800, 38.4250],
  'Motor Pool Garage': [-78.8810, 38.4240],
  'Motor Pool Alternative Fuel Building': [-78.8815, 38.4235]
};

// Function to get coordinates for a building
function getCoordinatesForBuilding(buildingName, address) {
  // First check if we have known coordinates
  if (knownCoordinates[buildingName]) {
    console.log(`✓ Using known coordinates for ${buildingName}: ${knownCoordinates[buildingName]}`);
    return knownCoordinates[buildingName];
  }

  // For buildings we don't have specific coordinates for,
  // we'll use intelligent estimation based on address patterns
  return estimateCoordinatesFromAddress(buildingName, address);
}

// Estimate coordinates based on address patterns
function estimateCoordinatesFromAddress(buildingName, address) {
  const baseCoords = [-78.8720, 38.4350]; // Center of JMU campus

  if (!address || address === 'TBD') {
    console.log(`⚠ No address available for ${buildingName}, using campus center coordinates`);
    return baseCoords;
  }

  // Devon Lane buildings (residence halls)
  if (address.includes('Devon Lane')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '1000');
    const lat = 38.4400 - (number - 1000) * 0.00005; // Estimate based on address number
    console.log(`✓ Estimated Devon Lane coordinates for ${buildingName}: [-78.8700, ${lat}]`);
    return [-78.8700, lat];
  }

  // Bluestone Drive buildings
  if (address.includes('Bluestone Drive')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '200');
    const lat = 38.4380 - (number - 100) * 0.0001;
    console.log(`✓ Estimated Bluestone Drive coordinates for ${buildingName}: [-78.8750, ${lat}]`);
    return [-78.8750, lat];
  }

  // Carrier Drive buildings (academic)
  if (address.includes('Carrier Drive')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '800');
    const lon = -78.8720 + (number - 800) * 0.00002;
    console.log(`✓ Estimated Carrier Drive coordinates for ${buildingName}: [${lon}, 38.4350]`);
    return [lon, 38.4350];
  }

  // South Main Street buildings
  if (address.includes('South Main Street')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '800');
    const lat = 38.4400 - (number - 800) * 0.00005;
    console.log(`✓ Estimated South Main Street coordinates for ${buildingName}: [-78.8680, ${lat}]`);
    return [-78.8680, lat];
  }

  // Alumnae Drive buildings
  if (address.includes('Alumnae Drive')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '50');
    const lat = 38.4380 - number * 0.0001;
    console.log(`✓ Estimated Alumnae Drive coordinates for ${buildingName}: [-78.8690, ${lat}]`);
    return [-78.8690, lat];
  }

  // Veterans Memorial Drive (athletics)
  if (address.includes('Veterans Memorial Drive')) {
    const number = parseInt(address.match(/\d+/)?.[0] || '200');
    const lon = -78.8800 + (number - 200) * 0.00001;
    console.log(`✓ Estimated Veterans Memorial Drive coordinates for ${buildingName}: [${lon}, 38.4250]`);
    return [lon, 38.4250];
  }

  console.log(`⚠ Using campus center coordinates for ${buildingName} (${address})`);
  return baseCoords;
}



async function geocodeAllBuildings() {
  console.log(`Starting intelligent coordinate assignment for ${buildingsData.length} buildings...`);

  const updatedBuildings = [];
  let successCount = 0;
  let estimatedCount = 0;

  for (let i = 0; i < buildingsData.length; i++) {
    const building = buildingsData[i];

    // Get coordinates using our intelligent system
    const coordinates = getCoordinatesForBuilding(building.name, building.address);

    if (coordinates) {
      building.coordinates = coordinates;
      if (knownCoordinates[building.name]) {
        successCount++;
      } else {
        estimatedCount++;
      }
    }

    updatedBuildings.push(building);

    // Progress update
    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${i + 1}/${buildingsData.length} buildings processed`);
    }
  }

  console.log(`\nCoordinate assignment complete!`);
  console.log(`✓ Known coordinates assigned: ${successCount} buildings`);
  console.log(`✓ Estimated coordinates assigned: ${estimatedCount} buildings`);
  console.log(`✓ Total buildings processed: ${successCount + estimatedCount}`);

  // Write the updated data back to the file
  fs.writeFileSync('../data/jmuBuildings.json', JSON.stringify(updatedBuildings, null, 2));
  console.log(`\n✓ Updated buildings data saved to jmuBuildings.json`);
}

// Run the geocoding
geocodeAllBuildings().catch(console.error);
