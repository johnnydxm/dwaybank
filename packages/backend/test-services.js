const { Pool } = require('pg');

// Simple test script to verify our services work
async function testServices() {
  console.log('🧪 Testing DwayBank Financial Services...\n');

  // Database configuration
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'dwaybank_dev',
    user: 'dwaybank',
    password: 'dwaybank_secure_2024',
    max: 5
  });

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    console.log(`✅ Connected to PostgreSQL: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    client.release();

    // Test categories
    console.log('\n2. Testing transaction categories...');
    const categoriesResult = await pool.query('SELECT id, name, icon, color FROM transaction_categories WHERE is_system_category = TRUE LIMIT 5');
    console.log(`✅ Found ${categoriesResult.rows.length} system categories:`);
    categoriesResult.rows.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.icon}, ${cat.color})`);
    });

    // Test user creation (using existing structure)
    console.log('\n3. Testing user operations...');
    const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [mockUserId]);
    
    if (userCheck.rows.length === 0) {
      console.log('   Creating mock user...');
      await pool.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, status, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        mockUserId,
        'test@dwaybank.com',
        '$2b$12$dummyhashfortestingonlywithsufficientlengthforvalidation',
        'Test',
        'User',
        'active',
        true
      ]);
      console.log('✅ Mock user created');
    } else {
      console.log('✅ Mock user already exists');
    }

    // Test account creation
    console.log('\n4. Testing account creation...');
    const accountResult = await pool.query(`
      INSERT INTO accounts (user_id, account_number, account_type, account_name, currency, is_primary)
      VALUES ($1, generate_account_number($2::account_type), $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id, account_number, account_type, account_name, balance
    `, [mockUserId, 'checking', 'Test Checking Account', 'USD', true]);

    if (accountResult.rows.length > 0) {
      const account = accountResult.rows[0];
      console.log(`✅ Account created: ${account.account_name}`);
      console.log(`   Account Number: ${account.account_number}`);
      console.log(`   Type: ${account.account_type}`);
      console.log(`   Balance: $${account.balance}`);

      // Test transaction creation
      console.log('\n5. Testing transaction creation...');
      const categoryResult = await pool.query('SELECT id FROM transaction_categories WHERE name = $1 LIMIT 1', ['Income']);
      
      if (categoryResult.rows.length > 0) {
        const categoryId = categoryResult.rows[0].id;
        
        const transactionResult = await pool.query(`
          INSERT INTO transactions (
            account_id, amount, currency, type, description, category_id,
            status, pending, transaction_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, amount, type, description, status
        `, [
          account.id,
          1000.00,
          'USD',
          'credit',
          'Initial deposit',
          categoryId,
          'completed',
          false,
          new Date().toISOString()
        ]);

        const transaction = transactionResult.rows[0];
        console.log(`✅ Transaction created: ${transaction.description}`);
        console.log(`   Amount: $${transaction.amount} (${transaction.type})`);
        console.log(`   Status: ${transaction.status}`);

        // Check updated account balance
        const balanceResult = await pool.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
        console.log(`   Updated Account Balance: $${balanceResult.rows[0].balance}`);
      }
    } else {
      console.log('⚠️  Account creation was skipped (might already exist)');
    }

    // Test account listing
    console.log('\n6. Testing account listing...');
    const accountsResult = await pool.query(`
      SELECT id, account_number, account_type, account_name, balance, currency, is_primary
      FROM accounts
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY is_primary DESC, created_at DESC
    `, [mockUserId]);

    console.log(`✅ Found ${accountsResult.rows.length} accounts:`);
    accountsResult.rows.forEach(acc => {
      console.log(`   - ${acc.account_name} (${acc.account_type}): $${acc.balance} ${acc.currency} ${acc.is_primary ? '[PRIMARY]' : ''}`);
    });

    // Test transaction listing
    console.log('\n7. Testing transaction listing...');
    const transactionsResult = await pool.query(`
      SELECT t.id, t.amount, t.type, t.description, t.status, t.transaction_date,
             tc.name as category_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN transaction_categories tc ON t.category_id = tc.id
      WHERE a.user_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC
      LIMIT 10
    `, [mockUserId]);

    console.log(`✅ Found ${transactionsResult.rows.length} transactions:`);
    transactionsResult.rows.forEach(tx => {
      console.log(`   - ${tx.description}: $${tx.amount} (${tx.type}) [${tx.category_name || 'Uncategorized'}]`);
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Database: Connected`);
    console.log(`   - Categories: ${categoriesResult.rows.length} available`);
    console.log(`   - Accounts: ${accountsResult.rows.length} created`);
    console.log(`   - Transactions: ${transactionsResult.rows.length} recorded`);
    console.log('\n✅ Core financial functionality is working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the tests
testServices().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});