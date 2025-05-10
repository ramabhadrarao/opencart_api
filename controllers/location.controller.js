// controllers/location.controller.js
import Country from '../models/country.model.js';
import Zone from '../models/zone.model.js';

// Get all countries
export const getCountries = async (req, res) => {
  try {
    const countries = await Country.find({ status: true }).sort({ name: 1 });
    res.json(countries);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching countries', error: err.message });
  }
};

// Get zones for a country
export const getZonesByCountry = async (req, res) => {
  try {
    const countryId = parseInt(req.params.country_id);
    
    const zones = await Zone.find({ 
      country_id: countryId,
      status: true
    }).sort({ name: 1 });
    
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching zones', error: err.message });
  }
};