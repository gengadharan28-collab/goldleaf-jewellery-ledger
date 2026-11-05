# Goldleaf Jewellery Ledger

Open the hosted app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/**. The app is responsive for phone and desktop.

## Data and cloud storage

Without cloud credentials, entries are saved in this browser's `localStorage` under `goldleaf-ledger-v1`. This stays on this browser and does not sync to other devices. Use **Settings → Download backup** regularly; a JSON backup can also be restored there.

To enable cross-device storage:

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL shown in **Settings → One-time database setup**. Row-level security limits each account to its own ledger row.
3. In **Settings → Cloud account**, enter the project URL and the public anon/publishable key. Never use a service-role key in the browser.
4. Create an account or sign in. Existing cloud data loads into the app; a new account starts with the current browser ledger. Later changes sync to that account.

Supabase handles the login and database. Local data and cloud data are distinct until sign-in; make a backup before the first cloud setup if the records matter.

## Workbook logic represented

- Parties: name, place, mobile, opening pure-gold balance. Registering a party immediately adds it to every party selector.
- Sales: payable pure grams = weight × purity ÷ 24 × (1 + wastage% ÷ 100).
- Metal bar / old scrap: enter testing purity manually as a percentage from 1 to 100 (decimals allowed); payment credit = gross weight × testing purity ÷ 100.
- Cash: payment credit = cash amount ÷ 24K rate per gram.
- Positive closing balance means the party owes gold; opening balance plus sales less payments gives the current balance.
- Single date, inclusive date range, month, and all-date filters are available in Party Summary and Party Ledger.

The referenced conversation did not include the Excel workbook itself. These formula rules follow the requested fields and common 24K pure-gold conversion; please compare them with the workbook if it becomes available.

## Local preview

From this folder, run `python -m http.server 8765`, then visit http://127.0.0.1:8765/.
