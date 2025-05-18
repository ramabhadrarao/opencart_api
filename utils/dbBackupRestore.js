// utils/dbBackupRestore.js
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Base directory for backups
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

/**
 * Create a backup of MongoDB database
 * @param {string} backupName - Optional name for the backup
 * @returns {Promise<string>} Path to the backup directory
 */
export const createBackup = async (backupName = '') => {
  try {
    // Create backup directory if it doesn't exist
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Generate backup directory name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dirName = backupName ? `${backupName}_${timestamp}` : `backup_${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, dirName);
    
    // Create backup-specific directory
    await fs.mkdir(backupPath, { recursive: true });
    
    // Get connection URI from env
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    // Parse MongoDB URI to extract database name
    const dbName = mongoURI.split('/').pop().split('?')[0];
    
    // Execute mongodump command
    const mongodump = spawn('mongodump', [
      `--uri=${mongoURI}`,
      `--out=${backupPath}`
    ]);
    
    return new Promise((resolve, reject) => {
      let errorOutput = '';
      
      mongodump.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      mongodump.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mongodump failed with code ${code}: ${errorOutput}`));
        } else {
          // Create a metadata file with backup info
          const metadata = {
            timestamp: new Date().toISOString(),
            database: dbName,
            collections: [],
            createdBy: 'OpenCart API'
          };
          
          fs.writeFile(
            path.join(backupPath, 'backup-metadata.json'),
            JSON.stringify(metadata, null, 2)
          ).then(() => {
            resolve(backupPath);
          }).catch(reject);
        }
      });
    });
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }
};

/**
 * Restore a MongoDB database from backup
 * @param {string} backupPath - Path to the backup directory
 * @returns {Promise<boolean>} Success indicator
 */
export const restoreBackup = async (backupPath) => {
  try {
    // Validate backup path exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      throw new Error(`Backup directory not found: ${backupPath}`);
    }
    
    // Get connection URI from env
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    
    // Execute mongorestore command
    const mongorestore = spawn('mongorestore', [
      `--uri=${mongoURI}`,
      '--drop', // Drop existing collections before importing
      backupPath
    ]);
    
    return new Promise((resolve, reject) => {
      let errorOutput = '';
      
      mongorestore.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      mongorestore.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mongorestore failed with code ${code}: ${errorOutput}`));
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    throw new Error(`Backup restoration failed: ${error.message}`);
  }
};

/**
 * Get a list of all available backups
 * @returns {Promise<Array>} List of available backups with metadata
 */
export const listBackups = async () => {
  try {
    // Create backup directory if it doesn't exist
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Get all subdirectories in the backup directory
    const files = await fs.readdir(BACKUP_DIR);
    
    // Get details for each backup
    const backups = [];
    
    for (const file of files) {
      const fullPath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        try {
          // Try to read metadata file
          const metadataPath = path.join(fullPath, 'backup-metadata.json');
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          
          backups.push({
            name: file,
            path: fullPath,
            created: metadata.timestamp,
            database: metadata.database,
            size: await calculateDirectorySize(fullPath)
          });
        } catch (err) {
          // If metadata file doesn't exist or is invalid, use file stats
          backups.push({
            name: file,
            path: fullPath,
            created: stats.mtime,
            size: await calculateDirectorySize(fullPath)
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
};

/**
 * Delete a backup
 * @param {string} backupName - Name of the backup to delete
 * @returns {Promise<boolean>} Success indicator
 */
export const deleteBackup = async (backupName) => {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName);
    
    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      throw new Error(`Backup not found: ${backupName}`);
    }
    
    // Delete backup directory recursively
    await fs.rm(backupPath, { recursive: true, force: true });
    
    return true;
  } catch (error) {
    throw new Error(`Failed to delete backup: ${error.message}`);
  }
};

/**
 * Calculate the size of a directory
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<number>} Size in bytes
 */
async function calculateDirectorySize(dirPath) {
  let totalSize = 0;
  
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      totalSize += await calculateDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};