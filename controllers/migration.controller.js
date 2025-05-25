// controllers/migration.controller.js (New Controller for Migration Status)
import MigrationStatus from '../models/migrationStatus.model.js';

// Get migration status overview
export const getMigrationStatus = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const migrations = await MigrationStatus.find().sort({ last_run: -1 });
    
    // Get collection counts
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const collectionCounts = {};
    for (const collection of collections) {
      try {
        const count = await db.collection(collection.name).countDocuments();
        collectionCounts[collection.name] = count;
      } catch (err) {
        collectionCounts[collection.name] = 0;
      }
    }
    
    // Calculate overall migration progress
    const totalMigrations = migrations.length;
    const completedMigrations = migrations.filter(m => m.status === 'completed').length;
    const failedMigrations = migrations.filter(m => m.status === 'failed').length;
    const runningMigrations = migrations.filter(m => m.status === 'running').length;
    
    res.json({
      overview: {
        total_migrations: totalMigrations,
        completed: completedMigrations,
        failed: failedMigrations,
        running: runningMigrations,
        progress_percentage: totalMigrations > 0 ? Math.round((completedMigrations / totalMigrations) * 100) : 0
      },
      migrations,
      collections: collectionCounts,
      generated_at: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching migration status', error: err.message });
  }
};

// Get specific migration details
export const getMigrationDetails = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const migrationName = req.params.name;
    const migration = await MigrationStatus.findOne({ name: migrationName });
    
    if (!migration) {
      return res.status(404).json({ message: 'Migration not found' });
    }
    
    res.json(migration);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching migration details', error: err.message });
  }
};

// Reset migration status (Admin only)
export const resetMigrationStatus = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const migrationName = req.params.name;
    
    await MigrationStatus.deleteOne({ name: migrationName });
    
    res.json({
      message: 'Migration status reset successfully',
      migration_name: migrationName
    });
  } catch (err) {
    res.status(500).json({ message: 'Error resetting migration status', error: err.message });
  }
};

export const migrationController = {
  getMigrationStatus,
  getMigrationDetails,
  resetMigrationStatus
};
