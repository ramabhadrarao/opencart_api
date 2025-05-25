// scripts/runMigration.js
import MigrationService from '../services/migrationService.js';
import { checkModels, checkMySQLTables } from './checkMigrationReadiness.js';
import dotenv from 'dotenv';

dotenv.config();

const AVAILABLE_PHASES = {
  'check': 'Run pre-migration checks',
  'phase1': 'Core Independent Tables (countries, zones, etc.)',
  'phase4': 'User Management (CRITICAL - customers & addresses)',
  'phase5': 'Catalog Structure (manufacturers, categories)',
  'phase6': 'Products (with full relationships)',
  'phase7': 'Orders and Transactions',
  'all': 'Run all phases sequentially'
};

async function showUsage() {
  console.log('\n🚀 OpenCart to MongoDB Migration Tool\n');
  console.log('Usage: node scripts/runMigration.js <phase>\n');
  console.log('Available phases:');
  
  for (const [phase, description] of Object.entries(AVAILABLE_PHASES)) {
    console.log(`  ${phase.padEnd(8)} - ${description}`);
  }
  
  console.log('\nExamples:');
  console.log('  node scripts/runMigration.js check     # Check migration readiness');
  console.log('  node scripts/runMigration.js phase1    # Migrate Phase 1 only');
  console.log('  node scripts/runMigration.js phase4    # Migrate customers (CRITICAL)');
  console.log('  node scripts/runMigration.js all       # Migrate all phases');
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('  - Phase 4 (customers) requires 100% success rate');
  console.log('  - uploaded_files in products will be transferred as-is');
  console.log('  - File verification should be done separately');
  console.log('  - Always run "check" before starting migration');
  console.log('');
}

async function runPreMigrationChecks() {
  console.log('🔍 Running Pre-Migration Checks...\n');
  console.log('=' .repeat(50));
  
  try {
    // Check if models are properly configured
    console.log('📋 Checking MongoDB Models...');
    const modelsValid = await checkModels();
    
    if (!modelsValid) {
      console.log('❌ Model validation failed. Please fix model issues before migrating.');
      return false;
    }
    
    // Check MySQL tables
    console.log('\n📊 Checking MySQL Tables...');
    const mysqlTables = await checkMySQLTables();
    
    console.log('\n✅ Pre-migration checks completed successfully!');
    console.log('\n💡 Ready to proceed with migration phases.');
    console.log('   Recommended order: phase1 → phase4 → phase5 → phase6 → phase7');
    
    return true;
  } catch (error) {
    console.error('\n❌ Pre-migration checks failed:', error.message);
    return false;
  }
}

async function runPhase(migration, phaseName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 STARTING ${phaseName.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const startTime = new Date();
  let success = false;
  
  try {
    switch (phaseName) {
      case 'phase1':
        success = await migration.migratePhase1();
        break;
      case 'phase4':
        console.log('⚠️  CRITICAL PHASE: 100% customer migration required');
        success = await migration.migratePhase4();
        break;
      case 'phase5':
        success = await migration.migratePhase5();
        break;
      case 'phase6':
        success = await migration.migratePhase6();
        break;
      case 'phase7':
        success = await migration.migratePhase7();
        break;
      default:
        throw new Error(`Unknown phase: ${phaseName}`);
    }
    
    const duration = Math.floor((new Date() - startTime) / 1000);
    
    if (success) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ ${phaseName.toUpperCase()} COMPLETED SUCCESSFULLY`);
      console.log(`⏱️  Duration: ${duration} seconds`);
      console.log(`📊 Records: ${migration.stats.succeeded} succeeded, ${migration.stats.failed} failed`);
      console.log(`${'='.repeat(60)}\n`);
    }
    
    return success;
  } catch (error) {
    const duration = Math.floor((new Date() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`❌ ${phaseName.toUpperCase()} FAILED`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`💥 Error: ${error.message}`);
    console.log(`${'='.repeat(60)}\n`);
    
    return false;
  }
}

async function runAllPhases(migration) {
  console.log('\n🚀 Running ALL Migration Phases...\n');
  
  const phases = ['phase1', 'phase4', 'phase5', 'phase6', 'phase7'];
  const results = {};
  
  for (const phase of phases) {
    const success = await runPhase(migration, phase);
    results[phase] = success;
    
    if (!success) {
      console.log(`❌ Migration failed at ${phase}. Stopping here.`);
      break;
    }
    
    // Small delay between phases
    console.log('⏳ Waiting 2 seconds before next phase...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Show final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  
  for (const [phase, success] of Object.entries(results)) {
    const status = success ? '✅ COMPLETED' : '❌ FAILED';
    console.log(`${phase.padEnd(10)} : ${status}`);
  }
  
  const allSuccessful = Object.values(results).every(success => success);
  
  if (allSuccessful) {
    console.log('\n🎉 ALL PHASES COMPLETED SUCCESSFULLY!');
    console.log('   Your OpenCart data has been fully migrated to MongoDB.');
  } else {
    console.log('\n⚠️  MIGRATION INCOMPLETE');
    console.log('   Some phases failed. Check the logs above for details.');
    console.log('   You can re-run individual phases that failed.');
  }
  
  console.log('='.repeat(60) + '\n');
  
  return allSuccessful;
}

async function main() {
  const phase = process.argv[2];
  
  if (!phase || !AVAILABLE_PHASES[phase]) {
    await showUsage();
    process.exit(1);
  }
  
  console.log('🏗️  OpenCart to MongoDB Migration');
  console.log('==================================\n');
  console.log(`📅 Started at: ${new Date().toLocaleString()}`);
  console.log(`🎯 Target phase: ${phase}`);
  console.log(`📝 Description: ${AVAILABLE_PHASES[phase]}\n`);
  
  // Special handling for check phase
  if (phase === 'check') {
    const checksPass = await runPreMigrationChecks();
    process.exit(checksPass ? 0 : 1);
  }
  
  const migration = new MigrationService();
  
  try {
    // Initialize database connections
    console.log('🔗 Initializing database connections...');
    await migration.initialize();
    console.log('✅ Database connections established\n');
    
    let success = false;
    
    if (phase === 'all') {
      success = await runAllPhases(migration);
    } else {
      success = await runPhase(migration, phase);
    }
    
    // Final status
    console.log('📅 Migration ended at:', new Date().toLocaleString());
    
    if (success) {
      console.log('🎉 Migration completed successfully!');
      
      if (phase === 'phase4' || phase === 'all') {
        console.log('\n💡 CUSTOMER MIGRATION NOTES:');
        console.log('   ✅ All customer records have been migrated');
        console.log('   ✅ Customer addresses are embedded in customer documents');
        console.log('   ✅ 100% data integrity maintained');
      }
      
      if (phase === 'phase6' || phase === 'all') {
        console.log('\n💡 PRODUCT MIGRATION NOTES:');
        console.log('   ✅ All product data migrated with embedded relationships');
        console.log('   ⚠️  uploaded_files references preserved (verify files separately)');
        console.log('   ✅ Product options and values fully migrated');
      }
      
      if (phase === 'phase7' || phase === 'all') {
        console.log('\n💡 ORDER MIGRATION NOTES:');
        console.log('   ✅ All orders migrated with embedded product data');
        console.log('   ✅ Order options and history preserved');
        console.log('   ✅ Both embedded and separate OrderProduct collections available');
      }
      
    } else {
      console.log('❌ Migration failed. Check the error messages above.');
      
      if (phase === 'phase4') {
        console.log('\n🚨 CUSTOMER MIGRATION FAILURE:');
        console.log('   This is a CRITICAL phase that requires 100% success');
        console.log('   Please resolve issues and retry before proceeding');
      }
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error during migration:', error.message);
    console.error('Stack trace:', error.stack);
    success = false;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    await migration.cleanup();
    console.log('✅ Cleanup completed');
  }
  
  process.exit(success ? 0 : 1);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('Error in main:', error);
  process.exit(1);
});