const DataInitializer = require('./utils/dataInitializer');
const path = require('path');

async function initializeDatabase() {
    const initializer = new DataInitializer();
    const csvPath = path.join(__dirname, 'data', 'rental_data.csv');

    try {
        const result = await initializer.initializeData(csvPath);
        console.log('\n🎉 Database initialization complete!');
        console.log('\nNext steps:');
        console.log('1. Run: npm start');
        console.log('2. Open: http://localhost:3000');
        console.log('3. Explore your property management dashboard\n');
    } catch (error) {
        console.error('❌ Initialization failed:', error);
    } finally {
        await initializer.close();
    }
}

// Run the initialization
initializeDatabase();