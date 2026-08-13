import mysql from 'mysql2/promise';

const {
  DATABASE_HOST = 'localhost',
  DATABASE_PORT = 3306,
  DATABASE_USER = 'root',
  DATABASE_PASSWORD = '',
  DATABASE_NAME = 'dormhive'
} = process.env;

const pool = mysql.createPool({
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 1
});

async function query(sql, values = []) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, values);
    return rows;
  } finally {
    connection.release();
  }
}

async function checkAndFixDatabase() {
  console.log('🔧 DormHive Database Setup Tool\n');
  
  try {
    console.log(`📡 Connecting to database: ${DATABASE_NAME} @ ${DATABASE_HOST}:${DATABASE_PORT}...`);
    
    // Check if properties table exists
    const tables = await query("SHOW TABLES LIKE 'properties'");
    
    if (tables.length === 0) {
      console.log('\n❌ Properties table does not exist. Creating database schema...\n');
      
      const migrations = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          avatar_url VARCHAR(255),
          role ENUM('tenant', 'owner', 'admin') DEFAULT 'tenant',
          status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Properties table
        `CREATE TABLE IF NOT EXISTS properties (
          id INT AUTO_INCREMENT PRIMARY KEY,
          owner_id INT NOT NULL,
          title VARCHAR(160) NOT NULL,
          description TEXT,
          address VARCHAR(255) NOT NULL,
          municipality VARCHAR(100) NOT NULL,
          barangay VARCHAR(100),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          room_type ENUM('bedspace', 'private_room', 'entire_unit') NOT NULL,
          monthly_rent DECIMAL(10, 2) NOT NULL,
          max_occupants INT NOT NULL,
          available_slots INT,
          gender_preference ENUM('co-ed', 'male', 'female'),
          amenities JSON,
          image_url VARCHAR(255),
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_status (status),
          INDEX idx_owner (owner_id),
          INDEX idx_municipality (municipality),
          INDEX idx_room_type (room_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Bookings table
        `CREATE TABLE IF NOT EXISTS bookings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          property_id INT NOT NULL,
          tenant_id INT NOT NULL,
          owner_id INT NOT NULL,
          move_in_date DATE,
          move_out_date DATE,
          message TEXT,
          status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
          FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_status (status),
          INDEX idx_property (property_id),
          INDEX idx_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Conversations table
        `CREATE TABLE IF NOT EXISTS conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          owner_id INT NOT NULL,
          property_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
          INDEX idx_tenant (tenant_id),
          INDEX idx_owner (owner_id),
          INDEX idx_property (property_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Messages table
        `CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          conversation_id INT NOT NULL,
          sender_id INT NOT NULL,
          body TEXT NOT NULL,
          read_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_conversation (conversation_id),
          INDEX idx_sender (sender_id),
          INDEX idx_read (read_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Notifications table
        `CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          read_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_read (read_at),
          INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        
        // Support tickets table
        `CREATE TABLE IF NOT EXISTS support_tickets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          subject VARCHAR(255) NOT NULL,
          description TEXT,
          status ENUM('open', 'in-progress', 'resolved', 'closed') DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_status (status),
          INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      ];
      
      for (const sql of migrations) {
        await query(sql);
        console.log('✓ Table created');
      }
      
      console.log('\n✅ Database schema created successfully!\n');
    } else {
      console.log('✓ Properties table exists\n');
      
      // Check for missing users columns
      const userColumns = await query('DESCRIBE users');
      const userColumnNames = userColumns.map(col => col.Field);
      if (!userColumnNames.includes('first_name')) {
        console.log('⚠️  Users table missing first_name column. Adding it...\n');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)");
        console.log('✓ first_name column added to users table');
      }
      if (!userColumnNames.includes('last_name')) {
        console.log('⚠️  Users table missing last_name column. Adding it...\n');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)");
        console.log('✓ last_name column added to users table');
      }
      if (!userColumnNames.includes('phone')) {
        console.log('⚠️  Users table missing phone column. Adding it...\n');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
        console.log('✓ phone column added to users table');
      }
      if (!userColumnNames.includes('avatar_url')) {
        console.log('⚠️  Users table missing avatar_url column. Adding it...\n');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)");
        console.log('✓ avatar_url column added to users table');
      }
      
      // Check for missing columns
      const columns = await query('DESCRIBE properties');
      const columnNames = columns.map(col => col.Field);
      
      const requiredColumns = {
        'available_slots': 'INT',
        'gender_preference': "ENUM('co-ed', 'male', 'female')",
        'amenities': 'JSON'
      };
      
      const missingColumns = Object.keys(requiredColumns).filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`⚠️  Found ${missingColumns.length} missing column(s). Adding them...\n`);
        
        const alterStatements = [
          "ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_slots INT AFTER max_occupants",
          "ALTER TABLE properties ADD COLUMN IF NOT EXISTS gender_preference ENUM('co-ed', 'male', 'female') AFTER available_slots",
          "ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities JSON AFTER gender_preference"
        ];
        
        for (const sql of alterStatements) {
          await query(sql);
          console.log(`✓ ${sql.split('ADD COLUMN')[1].trim().split(' ')[0]} column added`);
        }
        
        console.log('\n✅ Missing columns added successfully!\n');
      } else {
        console.log('✓ All required columns exist\n');
      }

      const conversationTableExists = (await query("SHOW TABLES LIKE 'conversations'"))[0] !== undefined;
      if (!conversationTableExists) {
        console.log('⚠️  Conversations table missing. Creating conversations table...\n');
        await query(`CREATE TABLE IF NOT EXISTS conversations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          owner_id INT NOT NULL,
          property_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
          INDEX idx_tenant (tenant_id),
          INDEX idx_owner (owner_id),
          INDEX idx_property (property_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        console.log('✓ Conversations table created\n');
      }

      const messageColumns = await query('DESCRIBE messages');
      const messageColumnNames = messageColumns.map(col => col.Field);
      const missingMessageColumns = [];
      if (!messageColumnNames.includes('conversation_id')) missingMessageColumns.push('conversation_id');
      if (!messageColumnNames.includes('body')) missingMessageColumns.push('body');

      if (missingMessageColumns.length > 0) {
        console.log(`⚠️  Found ${missingMessageColumns.length} missing messages column(s). Adding them...\n`);
        if (!messageColumnNames.includes('conversation_id')) {
          await query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id INT AFTER id');
          await query('ALTER TABLE messages ADD FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE');
          await query('CREATE INDEX IF NOT EXISTS idx_conversation ON messages (conversation_id)');
          console.log('✓ conversation_id column added');
        }
        if (!messageColumnNames.includes('body')) {
          await query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS body TEXT AFTER sender_id');
          console.log('✓ body column added');
        }
        console.log('\n✅ Missing messages columns added successfully!\n');
      }
    }
    
    console.log('✨ Database setup complete! You can now:');
    console.log('   1. Run the backend: npm start');
    console.log('   2. Create a new property with an image');
    console.log('   3. Verify the image appears in owner and tenant views\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure MySQL is running');
    console.error('2. Check your .env file has correct database credentials:');
    console.error(`   - DATABASE_HOST=${DATABASE_HOST}`);
    console.error(`   - DATABASE_PORT=${DATABASE_PORT}`);
    console.error(`   - DATABASE_USER=${DATABASE_USER}`);
    console.error(`   - DATABASE_NAME=${DATABASE_NAME}`);
    console.error('3. Verify the database exists in MySQL\n');
    process.exit(1);
  }
}

checkAndFixDatabase();
