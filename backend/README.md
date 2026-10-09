# DormHive backend media migration

Uploaded profile pictures, property photos, message photos, and support-ticket attachments are stored as `LONGBLOB` data in `media_files`. The API returns metadata and `/api/v1/media/:id` references; the bytes are streamed by an authenticated endpoint after checking the associated user, property, conversation, or ticket permissions. The existing `properties.image_url` and `properties.images` columns remain the listing-photo references; no duplicate `property_images` table is used.

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
