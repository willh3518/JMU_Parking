const fs = require('fs');

// Read the buildings data
const buildingsData = JSON.parse(fs.readFileSync('../data/jmuBuildings.json', 'utf8'));

console.log('🧪 Testing JMU Parking App Functionality with Official Buildings Database\n');

// Test 1: Database integrity
console.log('📊 Database Integrity Test:');
console.log(`✓ Total buildings loaded: ${buildingsData.length}`);

// Check required fields
let validBuildings = 0;
let missingFields = [];

buildingsData.forEach((building, index) => {
  const required = ['name', 'category', 'coordinates', 'description', 'buildingCode'];
  const missing = required.filter(field => !building[field]);
  
  if (missing.length === 0) {
    validBuildings++;
  } else {
    missingFields.push(`Building ${index + 1} (${building.name || 'Unknown'}): missing ${missing.join(', ')}`);
  }
});

console.log(`✓ Buildings with all required fields: ${validBuildings}/${buildingsData.length}`);
if (missingFields.length > 0) {
  console.log('⚠ Buildings with missing fields:');
  missingFields.slice(0, 5).forEach(msg => console.log(`   ${msg}`));
  if (missingFields.length > 5) {
    console.log(`   ... and ${missingFields.length - 5} more`);
  }
}

// Test 2: Categories distribution
console.log('\n📈 Categories Distribution:');
const categories = {};
buildingsData.forEach(building => {
  categories[building.category] = (categories[building.category] || 0) + 1;
});

Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
  console.log(`   ${category}: ${count} buildings`);
});

// Test 3: Search functionality simulation
console.log('\n🔍 Search Functionality Test:');

function testSearch(query) {
  const results = buildingsData.filter(building => {
    const q = query.toLowerCase();
    return (
      building.name.toLowerCase().includes(q) ||
      building.category.toLowerCase().includes(q) ||
      (building.buildingCode && building.buildingCode.toLowerCase().includes(q)) ||
      (building.departments && building.departments.some(dept => dept.toLowerCase().includes(q))) ||
      building.description.toLowerCase().includes(q) ||
      (building.address && building.address.toLowerCase().includes(q))
    );
  });
  return results;
}

const testQueries = [
  'Wilson Hall',
  'UREC',
  'ISAT',
  'residence',
  'library',
  'Bluestone Drive',
  'SHOW',
  'music',
  'dining'
];

testQueries.forEach(query => {
  const results = testSearch(query);
  console.log(`   "${query}": ${results.length} results`);
  if (results.length > 0) {
    console.log(`      → ${results[0].name} (${results[0].buildingCode})`);
    if (results.length > 1) {
      console.log(`      → ${results[1].name} (${results[1].buildingCode})`);
    }
    if (results.length > 2) {
      console.log(`      → ... and ${results.length - 2} more`);
    }
  }
});

// Test 4: Coordinate validation
console.log('\n🗺️ Coordinate Validation Test:');
let validCoordinates = 0;
let invalidCoordinates = [];

buildingsData.forEach(building => {
  const [lon, lat] = building.coordinates;
  
  // JMU campus is roughly between these coordinates
  const validLon = lon >= -78.90 && lon <= -78.85;
  const validLat = lat >= 38.40 && lat <= 38.45;
  
  if (validLon && validLat) {
    validCoordinates++;
  } else {
    invalidCoordinates.push(`${building.name}: [${lon}, ${lat}]`);
  }
});

console.log(`✓ Buildings with valid JMU campus coordinates: ${validCoordinates}/${buildingsData.length}`);
if (invalidCoordinates.length > 0) {
  console.log('⚠ Buildings with potentially invalid coordinates:');
  invalidCoordinates.slice(0, 3).forEach(msg => console.log(`   ${msg}`));
  if (invalidCoordinates.length > 3) {
    console.log(`   ... and ${invalidCoordinates.length - 3} more`);
  }
}

// Test 5: Official building codes
console.log('\n🏢 Official Building Codes Test:');
const codesWithAddresses = buildingsData.filter(b => b.buildingCode && b.address).length;
const codesWithoutAddresses = buildingsData.filter(b => b.buildingCode && !b.address).length;
const noCodes = buildingsData.filter(b => !b.buildingCode).length;

console.log(`✓ Buildings with codes and addresses: ${codesWithAddresses}`);
console.log(`✓ Buildings with codes but no addresses: ${codesWithoutAddresses}`);
console.log(`⚠ Buildings without official codes: ${noCodes}`);

// Test 6: Key buildings verification
console.log('\n🎯 Key Buildings Verification:');
const keyBuildings = [
  'Wilson Hall',
  'Carrier Library', 
  'University Recreation Center (UREC)',
  'Convocation Center',
  'Memorial Hall',
  'ISAT/CS Building',
  'Showker Hall'
];

keyBuildings.forEach(name => {
  const building = buildingsData.find(b => b.name === name);
  if (building) {
    console.log(`✓ ${name} found: ${building.buildingCode} at ${building.address || 'no address'}`);
  } else {
    console.log(`✗ ${name} NOT FOUND`);
  }
});

console.log('\n🎉 Testing Complete!');
console.log('\nSummary:');
console.log(`• ${buildingsData.length} total buildings from official JMU directory`);
console.log(`• ${Object.keys(categories).length} different building categories`);
console.log(`• ${validCoordinates} buildings with valid campus coordinates`);
console.log(`• ${codesWithAddresses} buildings with official codes and addresses`);
console.log(`• Search functionality supports name, code, category, department, description, and address queries`);
