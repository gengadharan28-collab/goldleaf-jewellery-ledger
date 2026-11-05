# Goldleaf Jewellery Ledger

Open the live app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/**. It works on phones and desktop browsers.

## Cloud setup

1. Open **Settings → Cloud account**.
2. Choose **Sign in / create account** and sign in, or create an account and verify your email if prompted.
3. Confirm **Cloud sync** appears in the desktop sidebar or below the heading on a phone.

Each signed-in account can access only its own ledger through Supabase row-level security. Before sign-in, entries stay in that browser. On the first sign-in, the current browser ledger is copied to the account; later changes sync to the same account. Download a backup from **Settings → Backup & setup** when needed.

## Features

- Party Register with name, place, mobile, and opening gold balance. Registered parties appear in party selectors.
- Sales Entry with auto-filled place, date/time, product, weight, pieces, purity, wastage, payable pure grams, and product photo.
- Payments by Metal Bar, Old Scrap, or Cash. Metal testing purity is typed manually as a percentage from 1 to 100, including decimals.
- Separate Party Ledger and Party Summary, with all-date, single-date, date-range, and monthly filters.
- Customer Register with name, city, phone, WhatsApp, photo upload or camera capture, Aadhaar, PAN, email, date of birth, address, notes, and opening balance in rupees.
- Separate Customer Ledger and Customer Summary. Customer sales and payments are tracked in rupees, independently from the party gold ledger.
- Editable product and purity lists, validation, and confirmation before saving profile edits.
- Light and dark themes. The theme choice stays on that device.
- Installable home-screen app for supported mobile browsers, with an app shell available offline after the first visit.

Sales payable = weight × purity ÷ 24 × (1 + wastage% ÷ 100). Metal payment credit = gross weight × testing purity ÷ 100. Cash payment credit = cash amount ÷ 24K rate per gram. A positive party closing balance means the party owes gold.

## Install on a phone

- **Android:** Open the app in Chrome and choose **Install app** or **Add to Home screen** when prompted.
- **iPhone:** Open the app in Safari, tap **Share**, then **Add to Home Screen**.

Camera capture requires HTTPS and permission from the user. Customer details and photos sync with the signed-in Supabase account, as configured for this app. Aadhaar and PAN are sensitive identifiers; restrict access to the account and device.

## Workbook match

The referenced conversation did not include the Excel workbook file. The app follows the requested fields and the calculation rules described in the conversation; compare with the workbook itself if exact sheet and formula matching is needed.

## Local preview

From this folder, run `python -m http.server 8765`, then visit http://127.0.0.1:8765/.
