# Property Image Upload Issue - Diagnostic & Fix Guide

## Problem Summary
After uploading a property with an image, the image is not visible in both owner and tenant views.

## Root Causes Identified

### 1. Missing Database Columns
The database table `properties` is missing the following columns that are being sent by the form:
- `available_slots` - Number of available slots
- `gender_preference` - Gender preference (co-ed, male, female)
- `amenities` - JSON array of amenities

**Without these columns, the INSERT statement fails silently.**

### 2. File Upload Setup
The backend is correctly configured to:
- Accept file uploads via multer (stored in `uploads/properties/`)
- Serve static files at `/uploads` endpoint
- Save image URL in database as `/uploads/properties/{filename}`

## Solution Steps

### Step 1: Update Your Database Schema

Run these SQL commands in your MySQL database:

```sql
-- Add missing columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_slots INT AFTER max_occupants;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gender_preference ENUM('co-ed', 'male', 'female') AFTER available_slots;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities JSON AFTER gender_preference;
```

Or if you need to create the entire `properties` table from scratch, see `backend/database/migrations.sql`

### Step 2: Verify Backend Configuration

The backend is already updated to save these fields. Verify:

1. **uploads directory exists:**
   ```bash
   mkdir -p backend/uploads/properties
   ```

2. **Check server.js** - Should have:
   ```javascript
   app.use('/uploads', express.static(path.resolve('uploads')));
   ```
   ✓ This is already configured

3. **Check upload.js** - Should accept only images:
   ```javascript
   fileFilter: (_request, file, callback) => {
     if (file.mimetype.startsWith('image/')) callback(null, true);
     else callback(new Error('Only image uploads are allowed.'));
   }
   ```
   ✓ This is already configured

### Step 3: Test the Fix

1. **Start your backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Start your frontend:**
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Test property creation:**
   - Navigate to "My Listings" in owner view
   - Click "Add a New Property"
   - Fill in all fields including:
     - Property basics (title, type, price, occupancy, slots, gender preference)
     - Location details (address, municipality, barangay)
     - Amenities (select at least one)
     - Upload an image
   - Click "Create Listing & Set Location"
   - Pin the location on the map and confirm

4. **Verify image appears:**
   - Check owner's "My Listings" table - should show thumbnail
   - Go to "Tenant View" and check dashboard - should show image on listing cards

## How Image URLs Work

**Backend:**
- Receives image file via `POST /api/v1/properties`
- Saves to disk at: `backend/uploads/properties/{timestamp}-{filename}`
- Stores URL in database: `/uploads/properties/{timestamp}-{filename}`
- Returns property with `image_url` field in API response

**Frontend (Owner View):**
```javascript
// In myListing.js line 513
const image = item.image_url ? `${API.replace(/\/api\/v1$/, '')}${item.image_url}` : '';
// Constructs: http://localhost:5000/uploads/properties/{filename}
```

**Frontend (Tenant View):**
```javascript
// In dashboardTenant.js line 71
const image = item.image_url ? `${API_URL.replace(/\/api\/v1$/, '')}${item.image_url}` : '';
// Same construction logic
```

**Static File Serving:**
```javascript
// In server.js line 37
app.use('/uploads', express.static(path.resolve('uploads')));
// Serves files from backend/uploads/properties/ at http://localhost:5000/uploads/
```

## Troubleshooting

If images still don't appear after these steps:

1. **Check browser console** for image load errors
2. **Check network tab** to see if image URL is correct
3. **Verify files exist:** Check `backend/uploads/properties/` directory
4. **Check database:** Verify `image_url` column has values
5. **Check backend logs** for any upload errors

## Files Modified
- ✓ `backend/models/Property.js` - Updated create() and update() to handle new fields
- ✓ `frontend/src/owner/myListing.js` - Multi-step form (already working correctly)
- ✓ `backend/database/migrations.sql` - SQL schema (NEW - needs to be run)
