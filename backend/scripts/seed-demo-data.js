import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../core/config/database.js';

const DEMO_DATABASE = 'dormhive_restore';
const DEMO_PASSWORD = '12345678';
const RECORD_COUNT = 50;

const locations = [
  { city: 'Manila', province: 'Metro Manila', barangay: 'Tondo', latitude: 14.6194, longitude: 120.9663 },
  { city: 'Quezon City', province: 'Metro Manila', barangay: 'Diliman', latitude: 14.6569, longitude: 121.0644 },
  { city: 'Makati', province: 'Metro Manila', barangay: 'Poblacion', latitude: 14.5653, longitude: 121.0318 },
  { city: 'Taguig', province: 'Metro Manila', barangay: 'Pinagsama', latitude: 14.5100, longitude: 121.0550 },
  { city: 'Pasig', province: 'Metro Manila', barangay: 'Kapasigan', latitude: 14.5606, longitude: 121.0795 },
  { city: 'Mandaluyong', province: 'Metro Manila', barangay: 'Highway Hills', latitude: 14.5833, longitude: 121.0499 },
  { city: 'Pasay', province: 'Metro Manila', barangay: 'Malibay', latitude: 14.5487, longitude: 121.0057 },
  { city: 'Parañaque', province: 'Metro Manila', barangay: 'BF Homes', latitude: 14.4478, longitude: 121.0165 },
  { city: 'Las Piñas', province: 'Metro Manila', barangay: 'Almanza Uno', latitude: 14.4375, longitude: 121.0101 },
  { city: 'Muntinlupa', province: 'Metro Manila', barangay: 'Alabang', latitude: 14.4186, longitude: 121.0414 },
  { city: 'Caloocan', province: 'Metro Manila', barangay: 'Bagong Silang', latitude: 14.7667, longitude: 121.0464 },
  { city: 'Marikina', province: 'Metro Manila', barangay: 'Concepcion Uno', latitude: 14.6351, longitude: 121.1029 },
  { city: 'Valenzuela', province: 'Metro Manila', barangay: 'Karuhatan', latitude: 14.7011, longitude: 120.9830 },
  { city: 'Antipolo', province: 'Rizal', barangay: 'San Roque', latitude: 14.5904, longitude: 121.1761 },
  { city: 'San Fernando', province: 'Pampanga', barangay: 'Dolores', latitude: 15.0343, longitude: 120.6893 },
  { city: 'Angeles', province: 'Pampanga', barangay: 'Balibago', latitude: 15.1594, longitude: 120.5901 },
  { city: 'Olongapo', province: 'Zambales', barangay: 'East Bajac-Bajac', latitude: 14.8292, longitude: 120.2828 },
  { city: 'Tarlac City', province: 'Tarlac', barangay: 'San Roque', latitude: 15.4802, longitude: 120.5979 },
  { city: 'Dagupan', province: 'Pangasinan', barangay: 'Pantal', latitude: 16.0374, longitude: 120.3335 },
  { city: 'Baguio', province: 'Benguet', barangay: 'Trancoville', latitude: 16.4263, longitude: 120.6000 },
  { city: 'Laoag', province: 'Ilocos Norte', barangay: 'San Nicolas', latitude: 18.1978, longitude: 120.5957 },
  { city: 'Vigan', province: 'Ilocos Sur', barangay: 'Tamag', latitude: 17.5747, longitude: 120.3869 },
  { city: 'Tuguegarao', province: 'Cagayan', barangay: 'Centro 10', latitude: 17.6132, longitude: 121.7270 },
  { city: 'Santiago', province: 'Isabela', barangay: 'Centro West', latitude: 16.6881, longitude: 121.5487 },
  { city: 'Cauayan', province: 'Isabela', barangay: 'San Fermin', latitude: 16.9348, longitude: 121.7698 },
  { city: 'Naga', province: 'Camarines Sur', barangay: 'Triangulo', latitude: 13.6218, longitude: 123.1948 },
  { city: 'Legazpi', province: 'Albay', barangay: 'Old Albay', latitude: 13.1391, longitude: 123.7438 },
  { city: 'Sorsogon City', province: 'Sorsogon', barangay: 'Balogo', latitude: 12.9736, longitude: 124.0053 },
  { city: 'Puerto Princesa', province: 'Palawan', barangay: 'San Pedro', latitude: 9.7392, longitude: 118.7353 },
  { city: 'Calapan', province: 'Oriental Mindoro', barangay: 'Tawiran', latitude: 13.4116, longitude: 121.1803 },
  { city: 'Batangas City', province: 'Batangas', barangay: 'Poblacion', latitude: 13.7565, longitude: 121.0583 },
  { city: 'Lipa', province: 'Batangas', barangay: 'Sabang', latitude: 13.9411, longitude: 121.1623 },
  { city: 'Lucena', province: 'Quezon', barangay: 'Gulang-gulang', latitude: 13.9414, longitude: 121.6231 },
  { city: 'Cebu City', province: 'Cebu', barangay: 'Lahug', latitude: 10.3297, longitude: 123.9069 },
  { city: 'Mandaue', province: 'Cebu', barangay: 'Banilad', latitude: 10.3236, longitude: 123.9223 },
  { city: 'Lapu-Lapu', province: 'Cebu', barangay: 'Pusok', latitude: 10.3103, longitude: 123.9494 },
  { city: 'Iloilo City', province: 'Iloilo', barangay: 'Jaro', latitude: 10.7202, longitude: 122.5621 },
  { city: 'Bacolod', province: 'Negros Occidental', barangay: 'Mandalagan', latitude: 10.6765, longitude: 122.9509 },
  { city: 'Dumaguete', province: 'Negros Oriental', barangay: 'Daro', latitude: 9.3068, longitude: 123.3054 },
  { city: 'Tagbilaran', province: 'Bohol', barangay: 'Cogon', latitude: 9.6476, longitude: 123.8554 },
  { city: 'Tacloban', province: 'Leyte', barangay: 'Downtown', latitude: 11.2444, longitude: 125.0039 },
  { city: 'Ormoc', province: 'Leyte', barangay: 'District 20', latitude: 11.0064, longitude: 124.6075 },
  { city: 'Roxas City', province: 'Capiz', barangay: 'Baybay', latitude: 11.5853, longitude: 122.7511 },
  { city: 'Kalibo', province: 'Aklan', barangay: 'Andagao', latitude: 11.7080, longitude: 122.3648 },
  { city: 'Davao City', province: 'Davao del Sur', barangay: 'Buhangin', latitude: 7.1167, longitude: 125.6267 },
  { city: 'Cagayan de Oro', province: 'Misamis Oriental', barangay: 'Carmen', latitude: 8.4781, longitude: 124.6334 },
  { city: 'General Santos', province: 'South Cotabato', barangay: 'Lagao', latitude: 6.1128, longitude: 125.1716 },
  { city: 'Zamboanga City', province: 'Zamboanga del Sur', barangay: 'Tetuan', latitude: 6.9214, longitude: 122.0790 },
  { city: 'Butuan', province: 'Agusan del Norte', barangay: 'Libertad', latitude: 8.9560, longitude: 125.5272 },
  { city: 'Iligan', province: 'Lanao del Norte', barangay: 'Pala-o', latitude: 8.2280, longitude: 124.2452 }
];

const makeEmail = (index, domain) => `${String(index).padStart(3, '0')}@${domain}`;
const owners = Array.from({ length: RECORD_COUNT }, (_, index) => {
  const sequence = index + 1;
  return {
    name: `Demo Owner ${String(sequence).padStart(3, '0')}`,
    firstName: 'Demo',
    lastName: `Owner ${String(sequence).padStart(3, '0')}`,
    email: makeEmail(sequence, 'owner.com'),
    role: 'owner'
  };
});
const tenants = Array.from({ length: RECORD_COUNT }, (_, index) => {
  const sequence = index + 1;
  return {
    name: `Demo Tenant ${String(sequence).padStart(3, '0')}`,
    firstName: 'Demo',
    lastName: `Tenant ${String(sequence).padStart(3, '0')}`,
    email: makeEmail(sequence, 'tenants.com'),
    role: 'tenant'
  };
});

async function seedDemoData() {
  if (process.env.DATABASE_NAME !== DEMO_DATABASE) {
    throw new Error(`Demo seeding is restricted to the ${DEMO_DATABASE} database.`);
  }
  if (process.env.DEMO_SEED_APPLY !== 'true') {
    throw new Error('No data was written. Set DEMO_SEED_APPLY=true to create the demo accounts and listings.');
  }
  if (locations.length !== RECORD_COUNT) {
    throw new Error(`Expected ${RECORD_COUNT} listing locations; found ${locations.length}.`);
  }
  if (locations.some(({ latitude, longitude }) => !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    throw new Error('Every demo listing location must have valid coordinates.');
  }

  const connection = await pool.getConnection();
  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS name');
    if (databaseRows[0]?.name !== DEMO_DATABASE) {
      throw new Error(`Connected database is not ${DEMO_DATABASE}; no data was written.`);
    }

    if (process.argv.includes('--update-locations')) {
      await connection.beginTransaction();
      let updatedCount = 0;
      for (const [index, owner] of owners.entries()) {
        const location = locations[index];
        const [matches] = await connection.execute(
          `SELECT p.id FROM properties p
           JOIN users u ON u.id = p.owner_id
           WHERE u.email = ? AND p.title = ? AND p.municipality = ? AND p.barangay = ?`,
          [
            owner.email,
            `Demo rental ${String(index + 1).padStart(3, '0')} - ${location.city}`,
            location.city,
            location.barangay
          ]
        );
        if (matches.length !== 1) {
          throw new Error(`Expected one matching listing for ${owner.email}; found ${matches.length}.`);
        }
        await connection.execute(
          'UPDATE properties SET latitude = ?, longitude = ? WHERE id = ?',
          [location.latitude, location.longitude, matches[0].id]
        );
        updatedCount += 1;
      }
      if (updatedCount !== RECORD_COUNT) {
        throw new Error(`Expected to update ${RECORD_COUNT} demo listings; matched ${updatedCount}.`);
      }
      await connection.commit();
      console.log(`Updated map coordinates for ${updatedCount} demo listings. Coordinates mark approximate barangay/city centers.`);
      return;
    }

    const emails = [...owners, ...tenants].map(({ email }) => email);
    const [existingUsers] = await connection.query(
      `SELECT email FROM users WHERE email IN (${emails.map(() => '?').join(', ')})`,
      emails
    );
    if (existingUsers.length) {
      throw new Error(`Found ${existingUsers.length} matching demo account(s). Refusing to modify existing data.`);
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await connection.beginTransaction();

    const allUsers = [...owners, ...tenants];
    const userValues = allUsers.flatMap(({ name, firstName, lastName, email, role }) => [
      name, firstName, lastName, email, passwordHash, role, 'active', 'approved'
    ]);
    const userPlaceholders = allUsers.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    await connection.execute(
      `INSERT INTO users (name, first_name, last_name, email, password_hash, role, status, verification_status) VALUES ${userPlaceholders}`,
      userValues
    );

    const ownerEmails = owners.map(({ email }) => email);
    const [ownerRows] = await connection.query(
      `SELECT id, email FROM users WHERE email IN (${ownerEmails.map(() => '?').join(', ')})`,
      ownerEmails
    );
    const ownerIds = new Map(ownerRows.map(({ id, email }) => [email, id]));
    const propertyValues = owners.flatMap((owner, index) => {
      const location = locations[index];
      const roomType = ['bedspace', 'private_room', 'entire_unit'][index % 3];
      const rent = 3500 + ((index * 1379) % 16500);
      return [
        ownerIds.get(owner.email),
        `Demo rental ${String(index + 1).padStart(3, '0')} - ${location.city}`,
        `Demo listing in ${location.barangay}, ${location.city}, ${location.province}.`,
        `${location.barangay}, ${location.city}, ${location.province}`,
        location.city,
        location.barangay,
        roomType,
        rent,
        2,
        2,
        2,
        'co-ed',
        JSON.stringify(['wifi', 'furnished']),
        location.latitude,
        location.longitude,
        null,
        JSON.stringify([]),
        null
      ];
    });
    const propertyPlaceholders = owners
      .map(() => `(${Array.from({ length: 18 }, () => '?').join(', ')}, 'approved')`)
      .join(', ');
    await connection.execute(
      `INSERT INTO properties (owner_id, title, description, address, municipality, barangay, room_type, monthly_rent, max_occupants, total_slots, available_slots, gender_preference, amenities, latitude, longitude, image_url, images, ownership_document_id, status) VALUES ${propertyPlaceholders}`,
      propertyValues
    );

    await connection.commit();
    console.log(`Created ${tenants.length} tenants, ${owners.length} owners, and ${owners.length} approved demo listings.`);
    console.log('Demo password for all accounts: 12345678');
    console.log('Tenant emails: 001@tenants.com through 050@tenants.com');
    console.log('Owner emails: 001@owner.com through 050@owner.com');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

seedDemoData()
  .catch((error) => {
    console.error(`Demo data seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
