# Goldleaf Jewellery Ledger

Open the live app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/** on phone or desktop.

## Install on a phone

Use **Add to Home** in the app header. Android browsers that support app installation show an install prompt. On iPhone, open the site in Safari, tap **Share**, then **Add to Home Screen**.

## Cloud account

1. Open **Settings → Cloud account**.
2. Choose **Sign in / create account** and enter your email and password.
3. For a new account, choose **Create account** and verify your email if prompted, then sign in.
4. **Cloud sync** below the page heading means the ledger is saved to your signed-in account and can be opened from another device.

The app stores each signed-in user's ledger in Supabase. Row-level security limits access to that user's records. Before sign-in, entries stay in that browser. Customer contact details, photos, Aadhaar and PAN are part of the synced account ledger. Download a backup from **Settings → Backup & setup** when needed.

## Features

- Dashboard workspace switcher for **Retail** and **Wholesale**. Retail shows **Customer Register, Customer Sales Entry, Customer Payment, Customer Ledger, Customer Summary**. Wholesale shows **Party Register, Party Sales Entry, Party Payments, Party Ledger, Party Summary**. Each workspace shows its own accounts and transactions.
- Party and customer registration, photos and contact details; customer opening balance is in rupees, party opening balance is in pure grams.
- One sales bill page per workspace with account selection, product, weight, pieces, purity, wastage, charges, discount, old gold exchange items and final balance. Each old gold item's testing purity is entered manually from 1 to 100.
- Wholesale payments for Metal Bar, Old Scrap and Cash; customer payments in rupees.
- Separate party gram ledgers/summaries and customer rupee ledgers/summaries, each with all-date, single-date, date-range and monthly filters.
- Editable product and karat lists; Rate Book for 24K, calculated 22K/18K/14K, old gold, silver and old silver; rate reminders at 11:00 AM and 6:00 PM India time.
- Light/dark theme, phone home-screen installation, and **Update History** with website version and release notes.

## Calculation guide

Party new sale payable = weight × purity ÷ 24 × (1 + wastage% ÷ 100). Party exchange credit = weight × manually entered testing purity% ÷ 100. The party ledger balance is kept in pure grams; the old gold rate and value are shown on the exchange entry.

Customer gold value = weight × purity ÷ 24 × 24K rate. Wastage adds the selected percentage of gold value. Making charges = pieces × making charge per piece. New sale total = gold value + wastage + making charges − discount. Old gold exchange = weight × testing purity% ÷ 100 × old gold rate. Amount to collect = new sale total − old gold exchange; a negative amount is shown as customer credit.

## Website updates

- **v1.6.0 · 5 Nov 2026:** Added separate Retail and Wholesale workspaces, with matching Party or Customer navigation and workspace-specific dashboard, register, sales, payments, ledgers and summaries.
- **v1.5.0 · 5 Nov 2026:** Put sale details, calculation, discount, old gold exchange and final balance in one sales bill.
- **v1.4.0 · 5 Nov 2026:** Combined Party/Customer Ledger pages and Summary pages with separate tabs.
- **v1.3.0 · 5 Nov 2026:** Combined Party Register and Customer Register with separate tabs.
- **v1.2.0 · 5 Nov 2026:** Added customer sales calculations, Rate Book, scheduled-time reminders and website Update History.
- **v1.1.0 · 5 Nov 2026:** Added customer profiles, separate rupee customer ledger/summary, themes and phone installation.

## Workbook match

The referenced conversation did not include the Excel workbook file. Calculations follow the fields and workflow described in that conversation; use the workbook itself if you need exact sheet-by-sheet formula matching.
