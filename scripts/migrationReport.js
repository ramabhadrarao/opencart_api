// scripts/migrationReport.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MigrationStatus from '../models/migrationStatus.model.js';

dotenv.config();

/**
 * Generate a migration status report
 */
const generateMigrationReport = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected\n');
    
    console.log('📊 Migration Status Report:\n');
    
    // Get all migration statuses
    const migrations = await MigrationStatus.find().sort({ name: 1 });
    
    if (migrations.length === 0) {
      console.log('⚠️ No migration records found. Has the migration process been run?');
      return;
    }
    
    // Calculate overall statistics
    const completed = migrations.filter(m => m.status === 'completed').length;
    const failed = migrations.filter(m => m.status === 'failed').length;
    const running = migrations.filter(m => m.status === 'running').length;
    const pending = migrations.filter(m => m.status === 'pending').length;
    
    // Print summary table
    console.log('='.repeat(80));
    console.log('| Status    | Count |');
    console.log('|-----------|-------|');
    console.log(`| Completed | ${completed.toString().padEnd(5)} |`);
    console.log(`| Failed    | ${failed.toString().padEnd(5)} |`);
    console.log(`| Running   | ${running.toString().padEnd(5)} |`);
    console.log(`| Pending   | ${pending.toString().padEnd(5)} |`);
    console.log(`| Total     | ${migrations.length.toString().padEnd(5)} |`);
    console.log('='.repeat(80));
    console.log('');
    
    // Print details for each migration
    console.log('Migration Details:');
    console.log('='.repeat(80));
    console.log('| Name                | Status    | Duration  | Processed | Success | Failed |');
    console.log('|---------------------|-----------|-----------|-----------|---------|--------|');
    
    for (const migration of migrations) {
      const name = migration.name.padEnd(19);
      const status = migration.status.padEnd(9);
      const duration = migration.duration_seconds 
        ? `${migration.duration_seconds.toFixed(1)}s`.padEnd(9) 
        : 'N/A'.padEnd(9);
      const processed = migration.processed 
        ? migration.processed.toString().padEnd(9) 
        : 'N/A'.padEnd(9);
      const success = migration.succeeded 
        ? migration.succeeded.toString().padEnd(7) 
        : 'N/A'.padEnd(7);
      const failed = migration.failed 
        ? migration.failed.toString().padEnd(6) 
        : 'N/A'.padEnd(6);
      
      console.log(`| ${name} | ${status} | ${duration} | ${processed} | ${success} | ${failed} |`);
    }
    console.log('='.repeat(80));
    
    // Print last run timestamps
    console.log('\nLast Run Information:');
    console.log('='.repeat(80));
    
    for (const migration of migrations) {
      if (migration.last_run) {
        console.log(`${migration.name}: ${migration.last_run.toISOString()}`);
        
        // Print error info for failed migrations
        if (migration.status === 'failed' && migration.error) {
          console.log(`  Error: ${migration.error}`);
        }
      }
    }
    console.log('='.repeat(80));
    
  } catch (err) {
    console.error('❌ Error generating migration report:', err.message);
  } finally {
    await mongoose.disconnect();
  }
};

// Run the report generator
generateMigrationReport();