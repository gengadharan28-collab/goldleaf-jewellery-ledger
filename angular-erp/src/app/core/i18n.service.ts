import { Injectable, signal } from '@angular/core';

export type AppLang = 'en' | 'ta';

const TA: Record<string, string> = {
  'Dashboard': 'முகப்பு',
  'Sales Entry': 'விற்பனை பதிவு',
  'Estimation / Quotation': 'மதிப்பீடு / கொட்டேஷன்',
  'Rate Book': 'விலை பட்டியல்',
  'Settings': 'அமைப்புகள்',
  'Sign out': 'வெளியேறு',
  'Retail': 'சில்லறை',
  'Wholesale': 'மொத்தம்',
  'Gold Pure Rate · 24K · ₹/g': 'தங்கம் சுத்த விலை · 24K · ₹/கி',
  'Gold Pure Cash Rate · 24K · ₹/g': 'தங்கம் சுத்த கேஷ் விலை · 24K · ₹/கி',
  'Gold Board Rate · 22K · ₹/g': 'தங்கம் போர்டு விலை · 22K · ₹/கி',
  'Gold Rate · 18K · ₹/g': 'தங்கம் விலை · 18K · ₹/கி',
  'Gold Rate · 14K · ₹/g': 'தங்கம் விலை · 14K · ₹/கி',
  'Silver Pure Rate · ₹/g': 'வெள்ளி சுத்த விலை · ₹/கி',
  'Save Shared Rates': 'பொது விலைகளைச் சேமி',
  'Save Cash Rate': 'கேஷ் விலையைச் சேமி',
  'Save Shop Rates': 'கடை விலைகளைச் சேமி',
  'Old Gold Exchange': 'பழைய தங்கம் மாற்றம்',
  'Sales Return': 'விற்பனை திரும்பப் பெறுதல்',
  'Save Settings': 'அமைப்புகளைச் சேமி',
  'Print Thermal': 'தெர்மல் பிரிண்ட்',
  'WhatsApp PDF': 'வாட்ஸ்அப் PDF',
  'Customers': 'வாடிக்கையாளர்கள்',
  'Sales Bills': 'விற்பனை பில்கள்',
  'Quotations': 'கொட்டேஷன்கள்',
  'Register': 'பதிவு',
  'Ledger': 'பேரேடு',
  'Chit & Jewel Loan': 'சீட்டு & நகை கடன்',
  'Stock & Reports': 'இருப்பு & அறிக்கைகள்',
  'Menu': 'பட்டியல்',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<AppLang>(
    localStorage.getItem('goldleaf-lang') === 'ta' ? 'ta' : 'en'
  );

  setLang(next: AppLang) {
    this.lang.set(next);
    localStorage.setItem('goldleaf-lang', next);
    document.documentElement.lang = next;
  }

  t(key: string): string {
    if (this.lang() === 'ta') return TA[key] || key;
    return key;
  }
}
