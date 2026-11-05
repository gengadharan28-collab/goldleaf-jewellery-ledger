# Goldleaf Jewellery Ledger

Open the live app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/**. It works on phones and desktop browsers.

## Start using the cloud app

1. Open **Settings → Cloud account**.
2. Choose **Sign in / create account** and enter your email and a password.
3. For a new account, choose **Create account** and verify your email if prompted. Then sign in.
4. Check the status on the left side of the desktop app or above the mobile menu. **Cloud sync** means the ledger is saved to your account and can be opened from another device.

The app is already connected to its Supabase database. Each signed-in account can access only its own ledger through row-level security. The app page and its source are public; party and transaction data are not. No service-role key is exposed in the browser.

Before sign-in, entries stay in that browser only. When a new account signs in for the first time, the app copies that browser's current ledger to the account. Later changes sync to the same account. Download a backup from **Settings → Backup & setup** when needed.

## Features

- Party Register with party name, place, mobile, and opening pure-gold balance. New parties appear in every party selector.
- Sales Entry with automatic place fill, date/time, product, weight, pieces, karat, wastage, payable pure grams, and product photo.
- Payments for Metal Bar, Old Scrap, or Cash. Metal testing purity is entered manually as a percentage from 1 to 100, including decimals.
- Party Ledger and Party Summary with all-date, single-date, date-range, and monthly filters.
- Editable product and karat lists.

Sales payable = weight × purity ÷ 24 × (1 + wastage% ÷ 100). Metal payment credit = gross weight × testing purity ÷ 100. Cash payment credit = cash amount ÷ 24K rate per gram. A positive closing balance means the party owes gold.

## Workbook match

The referenced conversation did not include the Excel workbook file. These calculations follow the requested fields and conversation details; compare with the workbook itself if you want exact sheet and formula matching.

## Local preview

From this folder, run `python -m http.server 8765`, then visit http://127.0.0.1:8765/.
