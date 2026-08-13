# 🏠 DormHive Property Image Upload - Quick Fix Guide

## The Issue
When you upload a property image and fill the form, the image doesn't appear in the owner's "My Listings" or the tenant's property cards.

## Why This Happens
The database table is missing 3 columns that the form collects:
- ❌ `available_slots` - Not saved to database
- ❌ `gender_preference` - Not saved to database  
- ❌ `amenities` - Not saved to database

Without these columns, the image upload fails silently.

---

## ✅ Quick Fix (5 minutes)

### Option A: Automatic Setup (Recommended)

1. **Update your `.env` file** (if needed):
   ```
   DATABASE_HOST=localhost
   DATABASE_PORT=3306
   DATABASE_USER=root
   DATABASE_PASSWORD=your_password
   DATABASE_NAME=dormhive
   ```

2. **Run the setup script:**
   ```bash
   cd backend
   node setup-db.js
   ```

3. **Done!** The script will automatically:
   - Create all tables if they don't exist
   - Add missing columns to the properties table
   - Verify everything is correct

### Option B: Manual SQL Commands

If you prefer running SQL directly, execute these in your MySQL client:

```sql
-- Add missing columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_slots INT AFTER max_occupants;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gender_preference ENUM('co-ed', 'male', 'female') AFTER available_slots;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities JSON AFTER gender_preference;
```

---

## 🧪 Test It

After running the setup:

1. **Start the backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Start the frontend** (new terminal):
   ```bash
   cd frontend
   npm start
   ```

3. **Add a property:**
   - Go to Owner → "My Listings"
   - Click "Add a New Property"
   - Fill ALL fields including:
     - ✓ Property title
     - ✓ Property type
     - ✓ Monthly price
     - ✓ Maximum occupancy
     - ✓ **Available slots** (new field)
     - ✓ **Gender preference** (new field - required!)
     - ✓ Address
     - ✓ Municipality
     - ✓ **Select amenities** (at least one - required!)
     - ✓ **Upload an image** (required!)
     - ✓ Description (optional)
   
4. **Confirm location** on the map

5. **Verify:**
   - Image appears in "My Listings" table thumbnail
   - Image appears in Tenant Dashboard property cards

---

## 🔧 How It Works

### Backend Flow
```
Form submitted (FormData)
    ↓
Multer saves image to: backend/uploads/properties/{timestamp}-{filename}
    ↓
Controller prepares data:
  - imageUrl: /uploads/properties/{timestamp}-{filename}
  - availableSlots: from form
  - genderPreference: from form
  - amenities: JSON array from checkboxes
    ↓
Database stores all fields
    ↓
SELECT * returns all fields including image_url
```

### Frontend Display
```
Fetch /api/v1/properties
    ↓
Response contains: { image_url: "/uploads/properties/..." }
    ↓
Frontend constructs full URL:
  http://localhost:5000/uploads/properties/...
    ↓
<img src="..."> displays the image
```

---

## 🆘 Still Not Working?

### Check 1: Database Columns
```sql
DESCRIBE properties;
```
Should show these columns:
- ✓ image_url
- ✓ available_slots
- ✓ gender_preference
- ✓ amenities

### Check 2: File Permissions
```bash
ls -la backend/uploads/properties/
```
Should show uploaded images (if any)

### Check 3: Browser Network
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try uploading a property
4. Look for image request - should return 200 OK
5. If 404, image URL is wrong or file doesn't exist

### Check 4: Backend Logs
```bash
# Terminal where backend is running
# Should show upload success message
```

### Check 5: Database Data
```sql
SELECT id, title, image_url, available_slots, gender_preference FROM properties LIMIT 1;
```
Should show:
- ✓ image_url is not NULL
- ✓ available_slots has a value
- ✓ gender_preference is not NULL
- ✓ amenities is not NULL

---

## 📋 Files Updated

- **backend/models/Property.js** - Now saves all form fields
- **backend/setup-db.js** - Automated database setup (NEW)
- **backend/database/migrations.sql** - Full schema (NEW)
- **frontend/src/owner/myListing.js** - Multi-step form (working correctly)
- **frontend/src/tenant/dashboardTenant.js** - Image display (working correctly)

---

## 📞 Need Help?

If you're still having issues:

1. **Verify .env credentials** are correct
2. **Run setup script again**: `node backend/setup-db.js`
3. **Check browser console** for JavaScript errors
4. **Check backend terminal** for upload errors
5. **Restart both frontend and backend**

---

**Last Updated:** 2026-08-06  
**Status:** ✅ Ready to Deploy
