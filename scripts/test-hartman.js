const fs = require('fs');

// Read the buildings data
const buildingsData = JSON.parse(fs.readFileSync('../data/jmuBuildings.json', 'utf8'));

console.log('🔍 Testing Hartman Hall and other specific buildings...\n');

// Test specific buildings you mentioned
const testBuildings = [
  'Hartman Hall',
  'Harper Allen-Lee Hall', 
  'Hillcrest Hall',
  'Holland Yates Hall',
  'Ice House',
  'Ikenberry Hall',
  'Grace St. Parking Deck',
  'Godwin Hall Bus Shelter',
  'Grafton-Stovall Theatre'
];

testBuildings.forEach(name => {
  const building = buildingsData.find(b => b.name.includes(name.replace(' (7-levels)', '').replace(' (formerly Madison Hall)', '')));
  if (building) {
    console.log(`✅ ${name}`);
    console.log(`   Code: ${building.buildingCode}`);
    console.log(`   Address: ${building.address || 'No address'}`);
    console.log(`   Category: ${building.category}`);
    console.log('');
  } else {
    console.log(`❌ ${name} - NOT FOUND`);
  }
});

// Test search functionality for Hartman
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

console.log('🔍 Search Tests:');
const searchTests = ['Hartman', 'HART', 'Harper', 'Ice House', 'Ikenberry'];

searchTests.forEach(query => {
  const results = testSearch(query);
  console.log(`"${query}": ${results.length} results`);
  results.forEach(r => console.log(`  → ${r.name} (${r.buildingCode})`));
  console.log('');
});

console.log(`📊 Total buildings in database: ${buildingsData.length}`);
