// controllers/backup.controller.js
import { 
  createBackup, 
  restoreBackup, 
  listBackups, 
  deleteBackup,
  formatBytes 
} from '../utils/dbBackupRestore.js';
import path from 'path';

/**
 * Create a database backup
 * @route POST /api/backup
 * @access Admin only
 */
export const createBackupHandler = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name } = req.body;
    
    // Validate backup name if provided
    if (name && (!/^[a-zA-Z0-9_-]+$/.test(name) || name.length > 50)) {
      return res.status(400).json({ 
        message: 'Invalid backup name. Use only letters, numbers, hyphens, and underscores. Max 50 characters.'
      });
    }
    
    console.log(`🔄 Starting backup${name ? ` with name: ${name}` : ''}...`);
    const backupPath = await createBackup(name);
    console.log(`✅ Backup completed: ${backupPath}`);
    
    const backupName = path.basename(backupPath);
    
    res.status(201).json({
      message: 'Backup created successfully',
      backupName,
      path: backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Backup error:', err.message);
    res.status(500).json({ message: 'Error creating backup', error: err.message });
  }
};

/**
 * Restore database from backup
 * @route POST /api/backup/restore/:backupName
 * @access Admin only
 */
export const restoreBackupHandler = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { backupName } = req.params;
    
    // Validate backup name
    if (!backupName) {
      return res.status(400).json({ message: 'Backup name is required' });
    }
    
    // Get available backups to check if the requested backup exists
    const backups = await listBackups();
    const backup = backups.find(b => b.name === backupName);
    
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }
    
    console.log(`🔄 Starting restoration from backup: ${backupName}`);
    await restoreBackup(backup.path);
    console.log(`✅ Restoration completed from backup: ${backupName}`);
    
    res.json({
      message: 'Database restored successfully',
      backupName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Restore error:', err.message);
    res.status(500).json({ message: 'Error restoring backup', error: err.message });
  }
};

/**
 * Get list of available backups
 * @route GET /api/backup
 * @access Admin only
 */
export const getBackupsHandler = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const backups = await listBackups();
    
    // Format backup sizes to be human-readable
    const formattedBackups = backups.map(backup => ({
      ...backup,
      size_raw: backup.size,
      size: formatBytes(backup.size)
    }));
    
    res.json({
      count: formattedBackups.length,
      backups: formattedBackups
    });
  } catch (err) {
    console.error('❌ Error listing backups:', err.message);
    res.status(500).json({ message: 'Error listing backups', error: err.message });
  }
};

/**
 * Delete a backup
 * @route DELETE /api/backup/:backupName
 * @access Admin only
 */
export const deleteBackupHandler = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { backupName } = req.params;
    
    // Validate backup name
    if (!backupName) {
      return res.status(400).json({ message: 'Backup name is required' });
    }
    
    // Get available backups to check if the requested backup exists
    const backups = await listBackups();
    const backup = backups.find(b => b.name === backupName);
    
    if (!backup) {
      return res.status(404).json({ message: 'Backup not found' });
    }
    
    console.log(`🔄 Deleting backup: ${backupName}`);
    await deleteBackup(backupName);
    console.log(`✅ Backup deleted: ${backupName}`);
    
    res.json({
      message: 'Backup deleted successfully',
      backupName
    });
  } catch (err) {
    console.error('❌ Error deleting backup:', err.message);
    res.status(500).json({ message: 'Error deleting backup', error: err.message });
  }
};