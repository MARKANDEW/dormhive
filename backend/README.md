# DormHive backend media migration

## Local demo accounts and listings

The demo data seeder creates 50 tenants (`001@tenants.com`–`050@tenants.com`), 50 owners (`001@owner.com`–`050@owner.com`), and one approved listing per owner across 50 Philippine locations. All demo accounts use `12345678`. The script is restricted to the local `dormhive_restore` database, refuses to run unless `DEMO_SEED_APPLY=true`, and stops if any matching account already exists.

Run it from this directory with the database configured in `.env`:

```powershell
$env:DEMO_SEED_APPLY = 'true'
npm run seed-demo-data
npm run seed-demo-data -- -- --update-locations
Remove-Item Env:DEMO_SEED_APPLY
```

The `--update-locations` mode updates only the matching demo listings' approximate barangay/city-center coordinates and is safe to rerun. These are local demo fixtures only; they are marked active/approved and their listings intentionally have no ownership-proof documents.

## Custom property types

The `properties.room_type` column is stored as `VARCHAR(100)` so owners can use the custom type entered through the `Other` property type option. For an existing database, run `npm run setup-db` from the backend directory to widen the current enum column while preserving existing property types.

Uploaded profile pictures, property photos, message photos, and support-ticket attachments are stored as `LONGBLOB` data in `media_files`. The API returns metadata and `/api/v1/media/:id` references; the bytes are streamed by an authenticated endpoint after checking the associated user, property, conversation, or ticket permissions. The existing `properties.image_url` and `properties.images` columns remain the listing-photo references; no duplicate `property_images` table is used.

## Registration ID verification

New tenant and owner registrations must include a JPEG, PNG, WEBP, or PDF ID file (up to 5 MB). The file is stored in the private `media_files` table and is only available to the applicant and administrators while the account is pending; the file is deleted after an admin makes a decision. New accounts cannot sign in until an administrator approves or rejects them in User management. The decision triggers an email to the applicant.

For an existing database, run `npm run setup-db` from this directory to add the verification columns. To send decision emails through Gmail, configure `SMTP_USER` with the Gmail address and `SMTP_PASSWORD` with a Google App Password; `SMTP_FROM` is optional and defaults to `SMTP_USER`. Without SMTP credentials, admin decisions still apply, but the UI explicitly reports that the email was not sent so the applicant can be contacted manually.

Password recovery uses a one-time email link that expires after 10 minutes. Configure `SMTP_USER` and `SMTP_PASSWORD` with a Gmail address and its Google App Password. If email is not configured or delivery fails, the recovery page directs users to contact support instead of presenting a non-working form.

## Property ownership review

Owner listings must include proof of ownership or authorization (JPEG, PNG, WEBP, or PDF, up to 5 MB). The proof is stored as private media, is not returned in tenant/public property responses, and can only be opened by administrators in Listing Moderation. Owners may have up to three listings pending review, and an owner cannot submit another pending or approved listing at the same normalized address. Editing an owner listing sends it back to pending review; a missing legacy proof or changed address requires a new proof document. Admin approval is blocked unless a valid private proof is linked to the listing. For an existing database, run `npm run setup-db` from this directory before using these checks.

## Existing database rollout

1. Back up the database and the `backend/core/uploads` directory.
2. From the backend directory, apply the idempotent media schema migration after the existing schema:

   ```powershell
   mysql -h $env:DATABASE_HOST -P $env:DATABASE_PORT -u $env:DATABASE_USER -p $env:DATABASE_NAME < .\core\database\media-storage.sql
   ```

   `npm run setup-db` also creates the media schema. It derives its foreign-key column types from the configured database so existing schemas that use `BIGINT UNSIGNED` IDs remain compatible.
3. With the backend `.env` database settings configured, run the one-time copy/update script:

   ```powershell
   npm run backfill-media
   ```

   It copies valid files from `core/uploads` into `media_files`, then replaces matching avatar, property-photo, and support-attachment paths in their existing records. It also converts legacy message bodies containing `data:image/...;base64` photos into message media records. The script is safe to rerun after successful rows have been updated.
4. Review the script summary and its per-record failures. Missing or unsupported files are left untouched in the database and on disk; resolve those records and rerun before removing any legacy data.
5. Verify the number of stored records and spot-check authenticated photo/message/ticket display flows. Keep the original uploads directory and a database backup until verification and your retention policy permit archival/removal.

Run the migration and backfill before deploying the version that disables `/uploads` static serving. That version does not read or serve legacy filesystem paths; records not backfilled will therefore not display until corrected. The script never deletes legacy files.

New uploads are limited to 2 MB per file and validated against file signatures/content before insertion. Supported image signatures are JPEG, PNG, GIF, and WEBP. Support attachments additionally allow PDF, plain UTF-8 text, legacy DOC, and DOCX content.
