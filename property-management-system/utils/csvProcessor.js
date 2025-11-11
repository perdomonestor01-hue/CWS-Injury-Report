const fs = require('fs');
const path = require('path');

class CSVProcessor {
    static parseCSVData(csvPath) {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n');

        // Parse property addresses from row 2 (index 1)
        const propertyRow = lines[1].split(',');
        const properties = propertyRow.slice(3, -6).filter(addr => addr && addr.trim() !== '');

        // Parse managers from row 5 (index 4)
        const managerRow = lines[4].split(',');
        const managers = managerRow.slice(3, properties.length + 3);

        // Parse financial data
        const rentIncomeRow = lines[7].split(',');
        const totalExpensesRow = lines[41].split(',');
        const mortgageBalanceRow = lines[55].split(',');

        const processedProperties = [];

        properties.forEach((address, index) => {
            if (!address || address.trim() === '') return;

            const cleanAddress = address.replace(/"/g, '').trim();
            const manager = managers[index] ? managers[index].replace(/"/g, '').trim() : 'Unknown';

            // Extract financial data for this property
            const rentIncome = this.parseFinancialValue(rentIncomeRow[index + 3]);
            const totalExpenses = this.parseFinancialValue(totalExpensesRow[index + 3]);
            const mortgageBalance = this.parseFinancialValue(mortgageBalanceRow[index + 3]);

            const netIncome = rentIncome - totalExpenses;
            const roi = mortgageBalance > 0 ? (netIncome / mortgageBalance * 100) : 0;

            processedProperties.push({
                id: index + 1,
                address: cleanAddress,
                manager: manager,
                rentIncome: rentIncome,
                totalExpenses: totalExpenses,
                netIncome: netIncome,
                mortgageBalance: mortgageBalance,
                roi: roi,
                status: 'Active',
                propertyType: this.inferPropertyType(cleanAddress),
                location: this.parseLocation(cleanAddress)
            });
        });

        return processedProperties;
    }

    static parseFinancialValue(value) {
        if (!value || value === '#N/A' || value.trim() === '') return 0;

        // Remove quotes, commas, and extra spaces
        const cleanValue = value.replace(/[",\s]/g, '');

        // Handle parentheses for negative values
        if (cleanValue.includes('(') && cleanValue.includes(')')) {
            return -parseFloat(cleanValue.replace(/[\(\)]/g, '')) || 0;
        }

        return parseFloat(cleanValue) || 0;
    }

    static inferPropertyType(address) {
        const lowerAddress = address.toLowerCase();

        if (lowerAddress.includes('unit') || lowerAddress.includes('apt') || /\d{3,}/.test(lowerAddress)) {
            return 'Multi-Family';
        } else if (lowerAddress.includes('ln') || lowerAddress.includes('dr') || lowerAddress.includes('cir')) {
            return 'Single Family';
        } else if (lowerAddress.includes('st ') || lowerAddress.includes('ave')) {
            return 'Townhouse';
        }

        return 'Single Family'; // Default
    }

    static parseLocation(address) {
        // Extract city/state from address (simplified - would need geocoding API for real coordinates)
        const parts = address.split(',');
        if (parts.length > 1) {
            return {
                city: parts[1].trim(),
                state: 'TX', // Assuming Texas based on the data
                coordinates: this.getCoordinatesForAddress(address)
            };
        }

        return {
            city: 'Unknown',
            state: 'TX',
            coordinates: { lat: 32.7767, lng: -96.7970 } // Dallas default
        };
    }

    static getCoordinatesForAddress(address) {
        // In a real application, you would use a geocoding service
        // For now, we'll return approximate Dallas area coordinates with some variation
        const baseLatitude = 32.7767;
        const baseLongitude = -96.7970;

        // Add some random variation for demo purposes
        const latVariation = (Math.random() - 0.5) * 0.2; // ±0.1 degrees
        const lngVariation = (Math.random() - 0.5) * 0.2;

        return {
            lat: baseLatitude + latVariation,
            lng: baseLongitude + lngVariation
        };
    }

    static groupByManager(properties) {
        const managerGroups = {};

        properties.forEach(property => {
            if (!managerGroups[property.manager]) {
                managerGroups[property.manager] = {
                    manager: property.manager,
                    properties: [],
                    totalProperties: 0,
                    totalRentIncome: 0,
                    totalExpenses: 0,
                    totalNetIncome: 0,
                    averageROI: 0
                };
            }

            managerGroups[property.manager].properties.push(property);
            managerGroups[property.manager].totalProperties++;
            managerGroups[property.manager].totalRentIncome += property.rentIncome;
            managerGroups[property.manager].totalExpenses += property.totalExpenses;
            managerGroups[property.manager].totalNetIncome += property.netIncome;
        });

        // Calculate average ROI for each manager
        Object.keys(managerGroups).forEach(manager => {
            const group = managerGroups[manager];
            const totalROI = group.properties.reduce((sum, prop) => sum + prop.roi, 0);
            group.averageROI = group.properties.length > 0 ? totalROI / group.properties.length : 0;
        });

        return managerGroups;
    }

    static calculatePortfolioMetrics(properties) {
        const totalProperties = properties.length;
        const totalRentIncome = properties.reduce((sum, prop) => sum + prop.rentIncome, 0);
        const totalExpenses = properties.reduce((sum, prop) => sum + prop.totalExpenses, 0);
        const totalNetIncome = totalRentIncome - totalExpenses;
        const totalMortgageBalance = properties.reduce((sum, prop) => sum + prop.mortgageBalance, 0);
        const averageROI = totalMortgageBalance > 0 ? (totalNetIncome / totalMortgageBalance * 100) : 0;

        const occupancyRate = properties.filter(prop => prop.status === 'Active').length / totalProperties * 100;

        return {
            totalProperties,
            totalRentIncome,
            totalExpenses,
            totalNetIncome,
            totalMortgageBalance,
            averageROI,
            occupancyRate,
            cashFlowPositive: properties.filter(prop => prop.netIncome > 0).length,
            topPerformers: properties
                .sort((a, b) => b.roi - a.roi)
                .slice(0, 5),
            underPerformers: properties
                .filter(prop => prop.netIncome < 0)
                .sort((a, b) => a.netIncome - b.netIncome)
                .slice(0, 5)
        };
    }
}

module.exports = CSVProcessor;