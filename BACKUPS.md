# Backups — set up once, restore if something goes wrong

You have **two kinds of backup**:

| | What | When | Where |
|---|---|---|---|
| **1. Automatic database backup** | The whole database (all tables, student logins, file records) + the list of files in the `materials` bucket — **encrypted** | Every night at 2:00 AM India time | GitHub → **Actions** → *Daily database backup* (kept 30 days) |
| **2. Export all data** | Every table as CSV files in a ZIP (opens in Excel / Google Sheets) | Whenever you click the button | Admin → **Settings** → *Export all data* |

> ⚠️ Neither backup contains the **PDF/ZIP files themselves** (they are in Supabase Storage). The backup has the **list** of files (`materials-files.csv`). Keep your original PDFs on your computer or Google Drive.

---

## Part A — Set up the automatic backup (one time, ~10 minutes)

### Step 1: Make the GitHub repository private again (strongly recommended)

GitHub → your repository **eduvora-website** → **Settings** → **General** → scroll to **Danger Zone** → **Change visibility** → **Make private**.

(The backups are encrypted, so they stay safe even on a public repository — but private is better: your code and backups are then visible only to you. Vercel keeps deploying because commits are made as *Aryaannnn*.)

### Step 2: Copy the database connection string from Supabase

1. Open **supabase.com** → your project (the one whose ID starts with `wezongzpot…`).
2. Click the **Connect** button at the top of the page.
3. In **Connection String**, choose **Type: URI** and the **Session pooler** option.
   ⚠️ Not *Direct connection* — GitHub's servers can't reach that one.
4. Copy the line. It looks like:
   `postgresql://postgres.wezongzpot…:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
5. Replace `[YOUR-PASSWORD]` (including the brackets) with your **database password**.
   - Forgot it? Supabase → **Project Settings → Database → Reset database password**. Use a password with only **letters and numbers** (symbols like `@ # /` break the link).
   - Resetting does not affect the website (the website uses API keys, not this password).

### Step 3: Make a backup passphrase

Make a long random passphrase (at least 16 characters, e.g. 5–6 random words). **Save it in your password manager or write it down safely.** Without it, the backups can never be opened — not even by GitHub or by us.

### Step 4: Add both as GitHub secrets

1. GitHub → **eduvora-website** → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** → Name: `SUPABASE_DB_URL` → Secret: the connection string from Step 2 → **Add secret**.
3. **New repository secret** → Name: `BACKUP_PASSPHRASE` → Secret: the passphrase from Step 3 → **Add secret**.

Secrets are hidden: nobody (including you) can read them back, and they never appear in the logs.

### Step 5: Run the first backup now

GitHub → **Actions** tab → **Daily database backup** (left side) → **Run workflow** → **Run workflow**.
After 1–3 minutes it turns green ✅. Open the run → at the bottom, under **Artifacts**, you see `eduvora-backup-2026-…` — that is the encrypted backup. From now on it runs every night by itself.

If it turns red ❌, open it and read the red message — usually the connection string (wrong password, or *Direct* instead of *Session pooler*).

---

## Part B — How to restore (if something goes wrong)

### First: what happened?

- **"I deleted or changed a few things by mistake"** (a product, a booking, a review…) → **Option 1** below. Small, safe, no technical tools.
- **"The whole database is broken / lost"** → **Option 2**. Bigger job — take a deep breath; your data is in the backup.

### Option 1 — Fix a few rows (easy)

1. Download the latest **Export all data** ZIP (if you made one before the mistake) **or** decrypt the nightly backup (steps 1–3 of Option 2) and open the CSV-friendly files.
2. Open the CSV in Excel / Google Sheets and find the old values.
3. Put them back by hand in the **Admin** pages or in **Supabase → Table Editor**.

### Option 2 — Restore the whole database

**You need:** a computer, the backup file (`eduvora-backup-….tar.gz.gpg`), your **BACKUP_PASSPHRASE**, and the free PostgreSQL 17 tools.

**1. Download the backup:** GitHub → **Actions** → pick a run from *before* the problem → **Artifacts** → download. (Unzip the downloaded `.zip` once — inside is the `.gpg` file.)

**2. Decrypt it** (turns it back into a normal file):
- **Windows (easy):** install **Gpg4win** (gpg4win.org) → open **Kleopatra** → **Decrypt/Verify** → choose the `.gpg` file → type your passphrase.
- **or** in **Git Bash**: `gpg --decrypt --output backup.tar.gz eduvora-backup-XXXX.tar.gz.gpg`

**3. Unpack it:** in Git Bash `tar -xzf backup.tar.gz` — you get:
- `database.dump` — the full database
- `public-schema.sql` — your table structure (readable)
- `materials-files.csv` — list of your PDF/ZIP files
- `row-counts.csv` — how many rows each table had (to check the restore)

**4. Restore into a NEW Supabase project** (safest — the broken one stays untouched):
1. supabase.com → **New project** (choose the same region, India/Mumbai). Copy its **Session pooler** connection string (Part A, Step 2).
2. Install the **PostgreSQL 17 command line tools** (postgresql.org → Download → Windows → choose only "Command Line Tools").
3. In Git Bash, in the unpacked folder, run these three commands (put your NEW connection string between the quotes):

```bash
NEW="postgresql://postgres.NEWPROJECT:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
pg_restore --no-owner --no-privileges --data-only --schema=auth -d "$NEW" database.dump                      # 1. student logins
pg_restore --no-owner --no-privileges --schema=public -d "$NEW" database.dump                              # 2. all your tables + rules
pg_restore --no-owner --no-privileges --data-only --schema=storage --table=objects -d "$NEW" database.dump  # 3. file records
```

   A few "already exists" warnings are normal. Compare the numbers in **Table Editor** with `row-counts.csv`.
4. In Supabase → **Storage**, re-upload your PDF/ZIP files into the `materials` bucket using the same folders/names as in `materials-files.csv` (or re-upload them in Admin → Products).
5. Point the website at the new project: Vercel → **Settings → Environment Variables** → update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` with the new project's values → **Redeploy**. Also update the Supabase **URL Configuration**, **Google** sign-in settings and the **SUPABASE_DB_URL** GitHub secret for the new project.

> 💡 Practise this once on a test project when nothing is wrong — then a real restore is calm and quick. If you get stuck, stop and ask for help; the backup file stays safe.

### Extra safety (optional)

Supabase's paid **Pro plan** also keeps its own daily backups (and "point-in-time recovery" as an add-on), restorable with one click in Supabase → **Database → Backups**.
