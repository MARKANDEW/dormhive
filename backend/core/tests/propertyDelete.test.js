import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch {
  // dotenv is optional in test execution when env already exists.
}

const connectionConfig = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER ?? 'root',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'dormhive_restore'
};

async function createTestOwner(connection) {
  const email = `owner-delete-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const [result] = await connection.execute(
    'INSERT INTO users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [`Owner ${Date.now()}`, email, 'hashed-pass', 'owner', 'active', '09170000000']
  );
  return { id: result.insertId, email };
}

async function createProperty(connection, ownerId) {
  const title = `Delete Test Property ${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [result] = await connection.execute(
    `INSERT INTO properties (owner_id, title, address, municipality, room_type, monthly_rent, max_occupants, available_slots, gender_preference, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
    [ownerId, title, '123 Test Street', 'Quezon City', 'bedspace', 15000, 4, 2, 'co-ed']
  );
  return { id: result.insertId, title };
}

async function createBooking(connection, propertyId, tenantId, ownerId) {
  const [result] = await connection.execute(
    'INSERT INTO bookings (property_id, tenant_id, move_in_date, occupants, status) VALUES (?, ?, ?, ?, ?)',
    [propertyId, tenantId, '2025-01-01', 1, 'pending']
  );
  return result.insertId;
}

test('property deletion removes dependent bookings before deleting the property', async () => {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    const owner = await createTestOwner(connection);
    const [tenantResult] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role, status, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [`Tenant ${Date.now()}`, `tenant-delete-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`, 'hashed-pass', 'tenant', 'active', '09170000001']
    );
    const property = await createProperty(connection, owner.id);
    await createBooking(connection, property.id, tenantResult.insertId, owner.id);

    const [rowsBeforeDelete] = await connection.execute('SELECT id FROM bookings WHERE property_id = ?', [property.id]);
    assert.equal(rowsBeforeDelete.length, 1);

    const { remove } = await import('../models/Property.js');
    await remove(property.id);

    const [remainingBookings] = await connection.execute('SELECT id FROM bookings WHERE property_id = ?', [property.id]);
    const [remainingProperty] = await connection.execute('SELECT id FROM properties WHERE id = ?', [property.id]);

    assert.equal(remainingBookings.length, 0);
    assert.equal(remainingProperty.length, 0);
  } finally {
    await connection.end();
  }
});
