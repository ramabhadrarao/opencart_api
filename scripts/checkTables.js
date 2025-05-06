// scripts/checkTables.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  const [tables] = await connection.execute(`SHOW TABLES`);
  const tableKey = Object.keys(tables[0])[0];

  console.log(`📊 Row counts in ${process.env.MYSQL_DATABASE}:\n`);

  for (const row of tables) {
    const tableName = row[tableKey];
    const [countRes] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    console.log(`${tableName}: ${countRes[0].count}`);
  }

  await connection.end();
};

run().catch(err => {
  console.error('❌ Error:', err.message);
});
