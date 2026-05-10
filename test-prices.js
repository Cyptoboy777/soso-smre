const fetch = require('node-fetch');

async function testPrices() {
  try {
    const res = await fetch('http://localhost:3000/api/prices');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test Failed:", e);
  }
}

testPrices();
