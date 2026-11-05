# Goldleaf Jewellery Ledger

Open the live app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/**. It works on phones and desktop browsers.

## Install on a phone

Use **Add to Home** in the app header. Android browsers that support app installation show their install prompt. On iPhone, open the site in Safari, tap **Share**, then **Add to Home Screen**. The installed app opens in a standalone window and can load its saved app shell offline.

## Cloud account

1. Open **Settings → Cloud account**.
2. Choose **Sign in / create account** and enter your email and a password.
3. For a new account, choose **Create account** and verify your email if prompted. Then sign in.
4. Check the status beneath the page heading on a phone or in the desktop sidebar. **Cloud sync** means the ledger is saved to your account and can be opened from another device.

The app uses its Supabase database. Each signed-in account can access only its own ledger through row-level security. Customer contact details, photos, Aadhaar and PAN are part of that account’s synced ledger. Before sign-in, entries stay in that browser only. Download a backup from **Settings → Backup & setup** when needed.

## Features

- **Party Register** for party name, city, phone, WhatsApp, email, address, and opening pure-gold balance.
- **Customer Register** for name, city, phone, WhatsApp, email, date of birth, address, Aadhaar, PAN, photo upload or webcam capture, notes, and opening balance in rupees.
- **Sales Entry** can select a party or customer. Customer sales use two tabs: sale details and amount/discount. The customer is selected first, then product, grams, pieces, purity, wastage, making charge per piece, and 24K rate.
- **Payments** can select a party or customer. Party payments support Metal Bar, Old Scrap, and Cash, with manual testing purity from 1 to 100. Customer payments are entered in rupees.
- Separate **Party Ledger / Party Summary** in grams and **Customer Ledger / Customer Summary** in rupees, with all-date, single-date, date-range, and monthly filters.
- Editable product and karat lists.
- **Rate Book** for the 24K gold base rate, purity-adjusted 22K/18K/14K reference rates, old gold, silver, and old silver.
- Gentle in-app rate reminders at **11:00 AM** and **6:00 PM India time**, with Later and Update rates actions. The reminder appears while the app is open or the next time it opens after a reminder time.
- **Update History** page with the current website version and release notes.
- Dark and light theme toggle. Theme choice stays on that device.

Party sales payable = weight × purity ÷ 24 × (1 + wastage% ÷ 100). Party metal payment credit = gross weight × testing purity ÷ 100. Party cash payment credit = cash amount ÷ 24K rate per gram.

Customer sale base gold value = weight × purity ÷ 24 × 24K rate. Wastage value = base gold value × wastage%. Making charges = pieces × making charge per piece. Final amount = base gold value + wastage value + making charges − discount. The discount cannot exceed the amount before discount.

## Website updates

- **v1.2.0 · 5 Nov 2026:** Customer sale calculator tabs, purity-adjusted 24K rate, Rate Book, twice-daily rate reminders, rate update history, and website Update History.
- **v1.1.0 · 5 Nov 2026:** Customer registration, separate rupee customer ledger and summary, themes, and home-screen installation.

## Workbook match

The referenced conversation did not include the Excel workbook file. These calculations follow the requested fields and conversation details; compare with the workbook itself if you want exact sheet and formula matching.

## Local preview

From this folder, run python -m http.server 8765, then visit http://127.0.0.1:8765/.
