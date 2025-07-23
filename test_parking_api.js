// Simple test script to verify the parking API works
const { fetchLiveParkingData } = require('./services/parkingService.ts');

async function testParkingAPI() {
  console.log('Testing JMU Parking API...');
  
  try {
    const data = await fetchLiveParkingData();
    console.log('✅ API call successful!');
    console.log('📊 Parking data received:');
    
    data.forEach(deck => {
      console.log(`  🅿️  ${deck.name}: ${deck.availableSpaces}/${deck.totalSpaces} (${deck.status})`);
    });
    
  } catch (error) {
    console.error('❌ API call failed:', error.message);
  }
}

testParkingAPI();
