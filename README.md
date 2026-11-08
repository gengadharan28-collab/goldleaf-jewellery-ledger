# Goldleaf Jewellery Ledger

Open the live app at **https://gengadharan28-collab.github.io/goldleaf-jewellery-ledger/**. It works on phones and desktop browsers.

## Install on a phone

Use **Add to Home** in the app header. Android browsers that support app installation show their install prompt. On iPhone, open the site in Safari, tap **Share**, then **Add to Home Screen**. The installed app opens in a standalone window and can load its saved app shell offline.

## Cloud account and shop subscriptions

New visitors can create a Goldleaf login from the Dashboard. Shop name, 15-character GST number, full address and phone are compulsory. The password is chosen by the account owner and is never stored in the website source. New shops receive a 7-day trial, one owner seat and one user seat. Shop details and ledger records are saved in Supabase; each shop has its own ledger protected by row-level security.

The initial Super Admin login is **gengadharan28@gmail.com**. Sign up with that email and the password you choose, then run `supabase_complete_setup.sql` once and `supabase_assign_admin.sql` to assign the administrator in the Supabase SQL Editor. The migration safely copies existing account ledgers into separate shop records, grants the initial admin role to that email, and installs the shop, trial, subscription, access and shared-rate rules. It contains no service-role key. Back up the Supabase project before applying database changes.

In the dedicated **Super Admin dashboard**, the administrator can inspect registered shops, renew monthly or yearly plans, grant a 7-day demo, suspend or restore access, and set user/owner seat limits. Shops can invite team members up to those limits. Super Admin also controls the shared Rate Book; saved rate changes are read by every shop. The app refreshes cloud data while open and syncs saved records across signed-in devices.

Sign in to the same shop account on a phone and computer to sync its records. Before sign-in, entries stay in that browser. Existing account ledgers are retained by the migration. Download a backup from **Settings → Backup & setup** before database changes.

## Super Admin portal

Open `?admin=1` to sign in directly. The admin portal has platform counts, Shops & access, Create shop invitations, Subscription plans, and Shared rates. Public `?signup=1` registration starts a 7-day trial with no workspace permission until Super Admin enables Retail, Wholesale, or both. Existing shop ledgers are retained. Payment counts reflect manually recorded received payments; changing a plan does not fabricate a payment. Owners choose their passwords when redeeming private shop invitation links. Shop dashboards show their plan, expiry and approved workspaces. Workspace permissions are enforced by database read/write functions as well as navigation. Local data is stored by shop to prevent a second account inheriting the previous account’s records.

## Features

- The **Dashboard** has separate **Retail** and **Wholesale** workspaces. Retail opens Customer Register, Customer Sales Entry, Customer Payment, Customer Ledger, and Customer Summary. Wholesale opens the corresponding Party pages. The selected workspace shows its own accounts and transactions.
- Party registration includes contact details and opening pure-gold balance. Customer registration includes contact and identity fields, photo upload or webcam capture, notes, and opening balance in rupees.
- Retail **Customer Sales Entry** uses a mobile-friendly ERP invoice with stacked sections, larger tap targets and normal page scrolling on phones; desktop keeps the compact wide-screen layout. It includes: customer, date, product, weight, pieces, purity, wastage, making charges, discount and totals. It uses the selected purity price from Rate Book; the invoice has no 24K rate box. Collection can be Cash, Cheque or GPay, with an optional cheque / transaction reference. The collected amount reduces the bill balance and appears in the Customer Ledger, Summary and payment history. **Old Gold Exchange** opens only from its button. Add old jewellery items with product, stated purity, weight, manually entered testing purity, rate per gram and calculated amount.
- Retail **Estimation / Quotation** includes customer, validity date, item rows or existing stock tags, purity-adjusted rates, wastage, per-piece making, optional GST, discount, old-gold credit, live totals, saved history, selected Retail PDF and a reviewable action to open a sales bill.
- Retail **Products and Tagging** keeps product groups, purity, HSN, wastage and making defaults with tagged stock records, unique barcode/tag codes, weight, purity, price, status and location. Choosing an in-stock tag on an estimate fills its item details.
- Retail **Chit** includes Group, Type, customer Mapping and instalment Entry, with date, number, amount, Cash/Cheque/GPay/Bank/Card method, reference, saved receipt history and printable receipts. Chit receipts stay separate from the Customer rupee ledger.
- Customer bills can be printed in two layouts: **Classic** and **Modern**. Choose **Print** in the bill header to select a template and open the browser print dialog; the printout includes the bill, old gold exchange, discount, collected amount, and balance due.
- Wholesale **Party Sales Entry** keeps the payable pure-gram calculation and adds optional HUID/Non-HUID hallmark charges. Enter a per-piece fee; the app multiplies it by sale pieces and shows the separate total in rupees.
- **Payments** stay in the selected workspace. Wholesale Party payments support Metal Bar, Old Scrap, and Cash, with manual testing purity from 1 to 100. Cash can be applied to the gold balance (converted at the 24K rate as before) or to the separate hallmark amount balance. Retail Customer payments are entered in rupees.
- Party and Customer ledgers and summaries stay in their own workspaces: Wholesale shows Party pages only; all Customer pages stay inside Retail. Party Ledger has no Customer selector or Customer section. Party balances show pure gold grams and hallmark rupees separately. The Party ledger PDF highlights both balances and keeps gold weights, cash amounts, and hallmark charges in separate columns. Use **View PDF** to open print preview and save as PDF, or **Share** to share the report text. All-date, single-date, date-range and monthly filters are available.
- Editable product and karat lists.
- **Shared Rate Book** for the 24K base, with manual 24K/22K/18K/14K rates, plus silver and old silver. Super Admin updates rates for every shop. Old gold exchange rate is entered on each exchange item.
- Gentle in-app rate reminders at **11:00 AM** and **6:00 PM India time**, with Later and Update rates actions. The reminder appears while the app is open or the next time it opens after a reminder time.
- **Update History** page with the current website version and release notes.
- Dark and light theme toggle. Theme choice stays on that device.

Party sales payable = weight × (purity% + wastage%) ÷ 100. Party metal payment credit = gross weight × testing purity ÷ 100. Party cash payment credit = cash amount ÷ 24K rate per gram.

Customer sale gold value = weight × selected-purity rate from Rate Book. Retail rates are entered manually for 24K, 22K, 18K and 14K; the selected purity rate is applied directly to the item weight. Wastage value = gold value × wastage%. Making charges = pieces × making charge per piece. New sale total = gold value + wastage value + making charges − discount. Old gold exchange amount = old jewellery weight × manually entered testing purity% ÷ 100 × old gold rate per gram. Balance due = new sale total − old gold exchange amount − collected amount. If old gold exceeds the new sale amount, the app shows customer credit; bill collection cannot exceed the positive balance remaining after old gold exchange. Collected amount is recorded with its method and appears as a payment in the customer ledger, summary, dashboard totals, printout and payment history. The discount cannot exceed the new sale amount before discount.

## Retail Sales and Purchase · v2.7.0

Retail **Sales** includes Bill, Sales Return, Receipt, Advance Amount and Metal Weight Advance. Bills accept multiple items with gross/less/net weight, selected karat price, wastage in percent or grams, making per piece/per gram/fixed, HUID/tag, HSN, stone and certificate charges. Collections can split Cash, Cheque, GPay, Bank transfer and Card. Optional GST supports inclusive/exclusive treatment; discount and rounding are saved with the bill. Cash advances remain a single ledger credit when allocated; metal advances are stored as pure grams and valued once at the agreed rate when applied. Returns refer to an original bill/item and cannot exceed remaining quantity/value. Existing single-item bills remain usable.

Retail **Purchase** includes Purchase, Purchase Return, Payment, Old Jewel Purchase, Old Jewel Purchase Return, Purchase Entry (Bills), and Kacha Pure Conversion. Supplier profiles are separate from customer accounts. Supplier balances keep rupees, Gold pure grams and Silver pure grams separate. Purchases can settle in rupees or metal plus cash charges. Supplier payments support split methods, metal delivery or cash converted to metal. Purchase returns reference original items; conversions reserve available old-metal source weights and record tested output, recovery and loss. A supplier linked to a Retail customer can apply an unpaid old Gold purchase as a sales exchange, without adding its physical weight twice.

All five Sales and seven Purchase sections offer saved history and PDF reports using the shop’s selected Retail template/header. Wholesale pages retain their existing workflow.

For an existing Supabase installation, apply **supabase_retail_documents.sql** before publishing v2.7.0. For v2.8.0, also run **supabase_retail_features.sql** once in the same Supabase SQL Editor. This safely extends the existing Retail document validator for estimates, products, tags and chit records. It does not erase or insert business records. All new records stay in `retailDocuments` inside the same shop-owned, row-level-secured `goldleaf_shop_ledgers.payload`; the Retail-only database filter still controls access. No extra login, public data store or new service key is introduced. Signed-in devices in the same shop merge these records by ID and update time. Both devices must sign in to the same shop to share cloud records. Until the one-time v2.8.0 SQL update is applied, new Retail feature saves remain on the device and may show a cloud validation error.

## Website updates

- **v2.8.0 · 7 Nov 2026:** Added Retail estimates/quotations with calculation, selected-template PDF, history and bill conversion; reusable product master; barcode tagging with item fill; and Chit Group, Type, Mapping and payment receipt workflows. Added the one-time **supabase_retail_features.sql** validator update for existing cloud setups.
- **v2.7.4 · 7 Nov 2026:** Retail Sales Entry shows saved bills below the form and lets you add a billing customer without leaving the draft. Adjustment buttons wrap at their natural width on phones.

- **v2.7.3 · 7 Nov 2026:** Item amounts and actions in Retail sales bills stay aligned with their column headings as the jewellery table scrolls horizontally. Adjustments and receipts use compact buttons with inline amounts.

- **v2.7.2 · 7 Nov 2026:** Retail sales bills scroll through adjustments and totals to the Save buttons. Removed the inline item-details instruction.

- **v2.7.1 · 7 Nov 2026:** Android layouts add Sales/Purchase section selectors, labelled item cards, larger touch controls, decimal keyboards and popup sizing that adapts to the visible keyboard area. Desktop Purchase keeps balance and PDF/Save actions visible.

- **v2.7.0 · 7 Nov 2026:** Added all five Retail Sales workflows and seven Purchase workflows, itemised bills, split collections, tracked advances/returns, supplier reports and old-metal conversion. Adapted the reference workflow to Goldleaf’s own responsive cream/gold/charcoal interface.

- **v2.6.0 · 7 Nov 2026:** Restored the previous cream, gold and charcoal palette. Added a reference-inspired ERP layout with searchable/collapsible sidebar, quick-navigation toolbar, shared-rate chips, and grouped financial/activity dashboards. Metric cards open their matching pages; calculations and saved data are unchanged.

- **v2.5.0 · 6 Nov 2026:** Applied one compact ERP interface across Retail, Wholesale, Super Admin, registers, ledgers, Settings and account screens, with new light/dark palettes and mobile table navigation. Optional Retail GST is now a small button beside Old Gold Exchange; both panels open above the full viewport even when the invoice is scaled. Unsaved invoice edits are kept while background sync runs.

- **v2.4.4 · 6 Nov 2026:** Added four bill/ledger PDF layouts selected in each Retail/Wholesale Settings page; editable shop headers and terms; automatic registered shop details; previews; optional Retail-only GST (off by default) with editable CGST/SGST or IGST. GST preferences and PDF headers sync with the shop. Historical bills keep their saved GST status. Retail GST is calculated on the new jewellery sale after discount, before exchange/collection credits. Wholesale PDF balances keep grams and hallmark rupees separate.

Retail layout research: [Vyapar jewellery bill examples](https://vyaparapp.in/bill-book-format/jewellery), [Zoho custom invoice templates](https://help.zoho.com/portal/en/kb/zoho-invoice/power-dialer/articles/how-do-i-create-and-assign-a-custom-template-to-my-invoices). GST reference: [CBIC sectoral FAQs](https://cbic-gst.gov.in/hindi/sectoral-faq.html).

- **v2.4.3 · 6 Nov 2026:** Moved shop subscription details from the top cards to one small running line at the bottom of shop dashboards. The line pauses on hover/focus and respects reduced motion settings.

- **v2.4.2 · 6 Nov 2026:** Added a quick Sign out button at the top of the shop and Super Admin dashboards, including mobile; reduced all six Super Admin count cards to one compact row.

- **v2.4.1 · 6 Nov 2026:** Added cloud reset markers, stale-device write protection and automatic removal of older local entries when an approved shop reset is received. Apply `supabase_reset_protection.sql` after the main setup; this file installs guards and does not erase records.

- **v2.4.0 · 6 Nov 2026:** Added separate Super Admin portal, signup and paid-shop dashboard, admin-approved Retail/Wholesale permissions, private shop invitations, plan pricing and payment receipts, and shop-scoped local storage.

- **v2.3.0 · 6 Nov 2026:** Added required shop registration, secure Super Admin controls, 7-day trials, monthly/yearly/demo renewals, owner/user seats and invitations, shop-level cloud ledgers, and centrally shared rates.

- **v2.0.9 · 6 Nov 2026:** Settings now accepts custom purity values from 1 to 100, including decimals.


- **v2.0.8 · 6 Nov 2026:** Reworked Retail invoice entry for mobile with readable stacked sections and natural scrolling; removed cloud status from the Dashboard view.

- **v2.0.7 · 6 Nov 2026:** Reduced redundant cloud checks, prevented overlapping sync requests, and kept open forms from resetting during a remote update.
- **v2.0.6 · 6 Nov 2026:** Removed Customer switching from Party Ledger and locked Party/Customer ledgers to their matching Wholesale/Retail workspaces.
- **v2.0.5 · 6 Nov 2026:** Added per-piece HUID/Non-HUID charges, separate Party gold and hallmark balances, and workspace-specific Party/Customer ledgers.
- **v2.0.4 · 6 Nov 2026:** Made syncing automatic and removed the manual sync button from Settings.
- **v2.0.3 · 6 Nov 2026:** Always merge device and cloud records on sign-in, saves and refresh; removed the two replace actions.

- **v2.0.2 · 6 Nov 2026:** Added email/password validation before account creation and clearer sign-up errors, including the anonymous sign-in case.
- **v2.0.1 · 6 Nov 2026:** Added phone-to-cloud and cloud-to-laptop replace controls with confirmation, conflict-aware cloud writes, and five-second refresh while open.
- **v2.0.0 · 6 Nov 2026:** Added manual/automatic karat rates, ERP-style Retail invoices without the 24K rate box, Cash/Cheque/GPay collections, detailed Customer and Party ledger reports with PDF/share actions, and same-account cloud sync with automatic refresh.
- **v1.9.0 · 5 Nov 2026:** Added bill collected amount, automatic Balance Due, ledger and summary collection tracking, clearer balance contrast, and Classic/Modern print templates.
- **v1.8.0 · 5 Nov 2026:** Fixed Retail Customer Sales Entry to a no-scroll single screen, made Old Gold Exchange an optional button-opened panel, and moved sales history to a separate History view. Wholesale party sales remain the simple entry form.
- **v1.7.0 · 5 Nov 2026:** Made Retail sales a single continuous view, tucked optional old-gold exchange behind a button, and restored the simple Wholesale party sales entry.
- **v1.6.0 · 5 Nov 2026:** Added separate Retail and Wholesale workspaces, their matching navigation, dashboards, registers, sales, payments, ledgers, and summaries.
- **v1.5.0 · 5 Nov 2026:** Added one-screen party/customer sales bills, discount and final balance, plus old gold exchange item details and testing-based valuation.
- **v1.4.0 · 5 Nov 2026:** Combined Party/Customer Summary and Ledger pages with separate Party and Customer tabs.
- **v1.3.0 · 5 Nov 2026:** Combined Party Register and Customer Register on one Register page with Party and Customer tabs.
- **v1.2.0 · 5 Nov 2026:** Customer sale calculator tabs, purity-adjusted 24K rate, Rate Book, twice-daily rate reminders, rate update history, and website Update History.
- **v1.1.0 · 5 Nov 2026:** Customer registration, separate rupee customer ledger and summary, themes, and home-screen installation.

## Workbook match

The referenced conversation did not include the Excel workbook file. These calculations follow the requested fields and conversation details; compare with the workbook itself if you want exact sheet and formula matching.

## Local preview

From this folder, run python -m http.server 8765, then visit http://127.0.0.1:8765/.

- **v2.8.1 · 7 Nov 2026:** Retail rate entry now follows a dated JewelGrow-style flow with manual 24K, 22K, 18K, 14K, silver and diamond rates, AM/PM entry, display and rate history. Retail bill pricing uses the saved matching karat rate when available.

- **v2.8.2 · 7 Nov 2026:** Finalised manual Retail rates and defaulted the Silver Board field from the saved silver price where no separate board rate exists.

- **v2.8.5 · 7 Nov 2026:** Added separate Retail Products, Tagging and Chit pages in the left navigation. They are also available from More on mobile.
- **v2.8.4 · 7 Nov 2026:** Retail Estimation / Quotation, Tagging and Chit open as separate pages from the top quick-access toolbar. Fixed full-page scrolling for Tagging and Chit on desktop and mobile.
- **v2.8.3 · 7 Nov 2026:** Retail Estimation / Quotation now appears directly beside Rate Book in the main navigation.

- **v2.8.6 · 7 Nov 2026:** Retail Products and Chit have independent sidebar sections below Sales and Purchase. Each opens only its own content; returning to Sales restores the sales workflow.
- **v2.9.0 · 8 Nov 2026:** Fixed desktop Retail Sales Bill scrolling by sizing the app scroll area to the viewport and keeping Save/Print actions reachable.
- **v2.9.1 · 8 Nov 2026:** Reordered Retail Chit steps as Group, Type, Mapping and Entry; Chit now opens at Group first.

- **v2.10.0 · 8 Nov 2026:** Expanded Retail Chit to seven scheme types (Digi Gold/Silver, Fixed, Flexi, One Time, Fixed Interest, Custom), group/type/mapping workflows, dues tracking, metal/testing payments, adjustments and printable receipts.


- **v2.10.1 · 8 Nov 2026:** Fixed nested Chit grids that squeezed Group, Type and Mapping forms, compacted the Chit summary cards and removed the default customer enrolment cap.


- **v2.10.2 · 8 Nov 2026:** Fixed cloud merge to retain Retail Chit, Products, Tagging and Estimation records on saves, refresh and across devices.

- **v2.10.3 · 8 Nov 2026:** Chit saves now wait for cloud sync to finish before reporting success and show a clear on-device-only message when cloud sync fails.

- **v2.10.4 · 8 Nov 2026:** Carry the shop reset token on Retail documents so Product, Tagging and Chit writes pass the reset guard; expose cloud write errors on Retail document saves.

- **v2.10.5 · 8 Nov 2026:** Remember each signed-in shop's active workspace and page so Retail or Wholesale reopens to the same screen after refresh; also remember the selected Retail sales tab.

- **v2.10.9 · 8 Nov 2026:** Expanded Retail Products and Tagging with JewelGrow-inspired gram/item workflows, MC and wastage modes, manual purity percentage, weight and stone fields, HUID, barcode scanning and improved mobile scrolling.

- **v2.10.10 · 8 Nov 2026:** Fixed Retail Sales screens stretching past phone width. Bill forms stay within the screen, with wide jewellery tables scrolling inside their own panels.

- **v2.10.11 · 8 Nov 2026:** Rebuilt Retail tagging as a batch workflow with Gram/Item modes and product catalog defaults. Includes lot/supplier/tray/counter metadata, barcode, per-tag weights/charges/stones/HUID/references, preview/print/history, and expanded Product Master fields. Mobile forms and contained tables improved.

- **v2.10.12 · 8 Nov 2026:** Refresh the app's offline shell and stylesheet cache so the expanded Retail Tagging and Product mobile layouts load on returning devices.

- **v2.10.13 · 8 Nov 2026:** Refreshed all Retail phone pages with a sectioned, touch-friendly card layout for Product, Tagging, Sales, Purchase, Chit, estimates and reports. Improved grouped fields, scan actions, sticky save controls and contained history tables; desktop styling remains unchanged.
