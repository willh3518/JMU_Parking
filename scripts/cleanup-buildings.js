const fs = require('fs');

// Read the current buildings data
const buildingsData = JSON.parse(fs.readFileSync('../data/jmuBuildings.json', 'utf8'));

console.log(`Starting cleanup of ${buildingsData.length} buildings...`);

// Remove duplicates based on building name
const uniqueBuildings = [];
const seenNames = new Set();

for (const building of buildingsData) {
  if (!seenNames.has(building.name)) {
    seenNames.add(building.name);
    uniqueBuildings.push(building);
  } else {
    console.log(`⚠ Removing duplicate: ${building.name}`);
  }
}

// Sort buildings alphabetically by name for easier management
uniqueBuildings.sort((a, b) => a.name.localeCompare(b.name));

console.log(`\nCleanup complete!`);
console.log(`✓ Original buildings: ${buildingsData.length}`);
console.log(`✓ Unique buildings: ${uniqueBuildings.length}`);
console.log(`✓ Duplicates removed: ${buildingsData.length - uniqueBuildings.length}`);

// Write the cleaned data back to the file
fs.writeFileSync('../data/jmuBuildings.json', JSON.stringify(uniqueBuildings, null, 2));
console.log(`\n✓ Cleaned buildings data saved to jmuBuildings.json`);

// Show some statistics
const categories = {};
uniqueBuildings.forEach(building => {
  categories[building.category] = (categories[building.category] || 0) + 1;
});

console.log('\n📊 Building Categories:');
Object.entries(categories).forEach(([category, count]) => {
  console.log(`   ${category}: ${count} buildings`);
});

console.log('\n🏢 Sample buildings:');
uniqueBuildings.slice(0, 5).forEach(building => {
  console.log(`   ${building.name} (${building.buildingCode}) - ${building.address || 'No address'}`);
});
