import React, { useState, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { Logo } from '../components/Logo';
import {
  ShoppingCart, LayoutGrid, Utensils, QrCode, Sparkles, WifiOff,
  ShieldCheck, Users, ArrowRight, Check, Globe, Printer, BarChart3,
  Heart, Menu, X, Store, Star,
} from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
}

export default function Landing({ onGetStarted }: LandingProps) {
  const { language, setLanguage } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Bilingual helper — Khmer-first product, English default copy.
  const km = language === 'km';
  const tx = (en: string, kmText: string) => (km ? kmText : en);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    { icon: ShoppingCart, title: tx('Point of Sale', 'ការលក់ (POS)'), desc: tx('Fast checkout, barcode scanning, discounts, and multi-payment (Cash, KHQR, Credit).', 'គិតលុយរហ័ស ស្កេនបាកូដ បញ្ចុះតម្លៃ និងទូទាត់ច្រើនប្រភេទ (សាច់ប្រាក់ KHQR ជំពាក់)។') },
    { icon: LayoutGrid, title: tx('Inventory', 'ស្តុកទំនិញ'), desc: tx('Products, variants, categories, and real-time stock tracking with low-stock alerts.', 'ទំនិញ ជម្រើស ប្រភេទ និងការតាមដានស្តុកភ្លាមៗ ជាមួយការជូនដំណឹងជិតអស់ស្តុក។') },
    { icon: Utensils, title: tx('Restaurant Mode', 'ភោជនីយដ្ឋាន'), desc: tx('Tables, kitchen display, order status, and reservations — built for F&B.', 'តុ អេក្រង់ផ្ទះបាយ ស្ថានភាពការកម្ម៉ង់ និងការកក់តុ សម្រាប់អាហារ និងភេសជ្ជៈ។') },
    { icon: QrCode, title: tx('QR Store & Menu', 'ហាង QR និងម៉ឺនុយ'), desc: tx('Customers scan to browse your menu and self-order online — no app install.', 'អតិថិជនស្កេនដើម្បីមើលម៉ឺនុយ និងកម្ម៉ង់ដោយខ្លួនឯង ដោយមិនចាំបាច់ដំឡើងកម្មវិធី។') },
    { icon: Sparkles, title: tx('AI Assistant', 'ជំនួយការ AI'), desc: tx('AI writes product descriptions, generates images, scans receipts, and gives business tips.', 'AI សរសេរបរិយាយទំនិញ បង្កើតរូបភាព ស្កេនវិក្កយបត្រ និងផ្តល់គន្លឹះអាជីវកម្ម។') },
    { icon: WifiOff, title: tx('Works Offline', 'ដំណើរការក្រៅបណ្តាញ'), desc: tx('Keep selling when the internet drops. Installable as an app on any phone.', 'បន្តលក់ បើទោះជាអ៊ីនធឺណិតដាច់។ ដំឡើងជាកម្មវិធីលើទូរស័ព្ទណាក៏បាន។') },
    { icon: Users, title: tx('Staff & Roles', 'បុគ្គលិក និងតួនាទី'), desc: tx('Admin, Manager, Cashier, Waiter, and Kitchen roles with secure 6-digit PIN login.', 'តួនាទី Admin, អ្នកគ្រប់គ្រង, អ្នកគិតលុយ, អ្នករត់តុ និងផ្ទះបាយ ជាមួយ PIN ៦ ខ្ទង់។') },
    { icon: ShieldCheck, title: tx('Secure by Design', 'សុវត្ថិភាពខ្ពស់'), desc: tx('Zero-knowledge vault with passkeys keeps your sensitive data encrypted end-to-end.', 'ប្រព័ន្ធអ៊ិនគ្រីប Zero-knowledge ជាមួយ Passkey ការពារទិន្នន័យសំខាន់ៗរបស់អ្នក។') },
  ];

  const steps = [
    { n: '1', title: tx('Create your shop', 'បង្កើតហាងរបស់អ្នក'), desc: tx('Sign in with Google, name your shop, and pick Retail or Restaurant.', 'ចូលដោយ Google ដាក់ឈ្មោះហាង ហើយជ្រើសរើសលក់រាយ ឬភោជនីយដ្ឋាន។') },
    { n: '2', title: tx('Add products', 'បញ្ចូលទំនិញ'), desc: tx('Add items manually or let AI help with descriptions, images, and barcodes.', 'បញ្ចូលទំនិញដោយដៃ ឬឱ្យ AI ជួយបរិយាយ រូបភាព និងបាកូដ។') },
    { n: '3', title: tx('Start selling', 'ចាប់ផ្តើមលក់'), desc: tx('Ring up sales, print receipts, share a QR menu, and track your profit.', 'លក់ បោះពុម្ពវិក្កយបត្រ ចែករំលែកម៉ឺនុយ QR និងតាមដានប្រាក់ចំណេញ។') },
  ];

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-white text-slate-800 font-sans">
      {/* ---------- NAV ---------- */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo className="w-9 h-9" textClassName={`text-lg ${scrolled ? 'text-slate-800' : 'text-white'}`} />
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
            <a href="#features" className={scrolled ? 'text-slate-600 hover:text-brand-600' : 'text-white/80 hover:text-white'}>{tx('Features', 'មុខងារ')}</a>
            <a href="#how" className={scrolled ? 'text-slate-600 hover:text-brand-600' : 'text-white/80 hover:text-white'}>{tx('How it works', 'របៀបប្រើ')}</a>
            <a href="#pricing" className={scrolled ? 'text-slate-600 hover:text-brand-600' : 'text-white/80 hover:text-white'}>{tx('Pricing', 'តម្លៃ')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(km ? 'en' : 'km')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${scrolled ? 'border-gray-200 text-slate-600 hover:bg-gray-50' : 'border-white/30 text-white hover:bg-white/10'}`}
            >
              <Globe size={14} /> {km ? 'EN' : 'ខ្មែរ'}
            </button>
            <button
              onClick={onGetStarted}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all active:scale-95"
            >
              {tx('Sign In', 'ចូលប្រើ')} <ArrowRight size={14} />
            </button>
            <button onClick={() => setMenuOpen(v => !v)} className={`md:hidden p-2 rounded-lg ${scrolled ? 'text-slate-700' : 'text-white'}`}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 flex flex-col gap-3 text-sm font-bold text-slate-700">
            <a href="#features" onClick={() => setMenuOpen(false)}>{tx('Features', 'មុខងារ')}</a>
            <a href="#how" onClick={() => setMenuOpen(false)}>{tx('How it works', 'របៀបប្រើ')}</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>{tx('Pricing', 'តម្លៃ')}</a>
            <button onClick={onGetStarted} className="mt-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white">
              {tx('Sign In', 'ចូលប្រើ')} <ArrowRight size={14} />
            </button>
          </div>
        )}
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-brand-700 to-brand-600 pt-28 pb-24 md:pt-36 md:pb-32">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }} />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent-500/30 rounded-full blur-[110px]" />
        <div className="absolute top-10 -right-24 w-80 h-80 bg-purple-500/30 rounded-full blur-[90px]" />

        <div className="relative z-10 max-w-6xl mx-auto px-5 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-bold backdrop-blur-md mb-6">
            <Heart size={13} className="text-red-300" /> {tx('Free & open source · Made for Cambodia', 'ឥតគិតថ្លៃ · បង្កើតឡើងសម្រាប់កម្ពុជា')}
          </span>
          <h1 className={`text-4xl md:text-6xl font-black text-white leading-tight tracking-tight mb-5 ${km ? 'font-display' : ''}`}>
            {tx('The smart POS for', 'ប្រព័ន្ធ POS ឆ្លាតវៃ')}<br className="hidden md:block" />{' '}
            <span className="bg-gradient-to-r from-amber-300 to-teal-200 bg-clip-text text-transparent">
              {tx('Cambodian businesses', 'សម្រាប់អាជីវកម្មខ្មែរ')}
            </span>
          </h1>
          <p className={`max-w-2xl mx-auto text-lg md:text-xl text-brand-100/90 mb-9 leading-relaxed ${km ? 'font-display' : ''}`}>
            {tx(
              'Sell, manage inventory, run your restaurant, and understand your profit — all from your phone. Khmer-first, works offline, powered by AI.',
              'លក់ គ្រប់គ្រងស្តុក ដំណើរការភោជនីយដ្ឋាន និងយល់ពីប្រាក់ចំណេញ — គ្រប់យ៉ាងពីទូរស័ព្ទ។ ភាសាខ្មែរ ដំណើរការក្រៅបណ្តាញ ជាមួយ AI។'
            )}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-brand-700 font-bold text-base hover:bg-brand-50 shadow-2xl shadow-black/20 transition-all active:scale-95"
            >
              {tx('Get Started — Free', 'ចាប់ផ្តើម — ឥតគិតថ្លៃ')} <ArrowRight size={18} />
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/10 border border-white/25 text-white font-bold text-base hover:bg-white/20 backdrop-blur-md transition-all active:scale-95"
            >
              {tx('Explore Features', 'មើលមុខងារ')}
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-white/80 text-sm font-semibold">
            {[
              tx('No monthly fees', 'គ្មានថ្លៃប្រចាំខែ'),
              tx('Works offline', 'ដំណើរការក្រៅបណ្តាញ'),
              tx('Khmer & English', 'ខ្មែរ និងអង់គ្លេស'),
              tx('Riel & KHQR ready', 'រៀល និង KHQR'),
            ].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-2"><Check size={16} className="text-teal-300" /> {f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- BUSINESS TYPES ---------- */}
      <section className="max-w-6xl mx-auto px-5 -mt-14 relative z-20">
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            { icon: Store, title: tx('Retail Shops', 'ហាងលក់រាយ'), desc: tx('Groceries, boutiques, mobile & electronics, pharmacies, minimarts.', 'ហាងទំនិញ សម្លៀកបំពាក់ ទូរស័ព្ទ អេឡិចត្រូនិច ឱសថស្ថាន មីនីម៉ាត។'), color: 'from-brand-500 to-brand-600' },
            { icon: Utensils, title: tx('Restaurants & Cafés', 'ភោជនីយដ្ឋាន និងកាហ្វេ'), desc: tx('Tables, kitchen tickets, QR self-ordering, and reservations.', 'តុ សំបុត្រផ្ទះបាយ ការកម្ម៉ង់ QR និងការកក់តុ។'), color: 'from-accent-500 to-accent-600' },
          ].map((b, i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 shadow-card p-7 flex items-start gap-5 hover:shadow-soft transition-shadow">
              <div className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${b.color} text-white flex items-center justify-center shadow-lg`}>
                <b.icon size={26} />
              </div>
              <div>
                <h3 className={`font-black text-lg text-slate-900 mb-1 ${km ? 'font-display' : ''}`}>{b.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-brand-600 font-bold text-sm uppercase tracking-wider mb-2">{tx('Everything in one app', 'គ្រប់យ៉ាងក្នុងកម្មវិធីតែមួយ')}</p>
          <h2 className={`text-3xl md:text-4xl font-black text-slate-900 ${km ? 'font-display' : ''}`}>{tx('Powerful features, simple to use', 'មុខងារខ្លាំង ងាយស្រួលប្រើ')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div key={i} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:border-brand-200 hover:shadow-soft transition-all">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <f.icon size={24} />
              </div>
              <h3 className={`font-bold text-slate-900 mb-2 ${km ? 'font-display' : ''}`}>{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- BUILT FOR CAMBODIA ---------- */}
      <section className="bg-slate-50 border-y border-gray-100 py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className={`text-3xl md:text-4xl font-black text-slate-900 mb-5 ${km ? 'font-display' : ''}`}>
              {tx('Built for Cambodia 🇰🇭', 'បង្កើតឡើងសម្រាប់កម្ពុជា 🇰🇭')}
            </h2>
            <p className={`text-slate-600 text-lg leading-relaxed mb-7 ${km ? 'font-display' : ''}`}>
              {tx(
                'Haang understands how local businesses really work — from selling on credit to unreliable internet.',
                'Haang យល់ពីរបៀបដែលអាជីវកម្មក្នុងស្រុកដំណើរការ — ចាប់ពីការលក់ជំពាក់ រហូតដល់អ៊ីនធឺណិតមិនស្ថិតស្ថេរ។'
              )}
            </p>
            <ul className="space-y-4">
              {[
                { icon: Globe, t: tx('Khmer-first interface', 'ផ្ទៃប្រើប្រាស់ភាសាខ្មែរ'), d: tx('Full Khmer support, plus English, Chinese, Japanese & Korean.', 'ភាសាខ្មែរពេញលេញ បូកនឹងអង់គ្លេស ចិន ជប៉ុន និងកូរ៉េ។') },
                { icon: Heart, t: tx('Credit / debt tracking', 'តាមដានការជំពាក់'), d: tx('Record "pay later" sales and track each customer\'s balance.', 'កត់ត្រាការលក់ជំពាក់ និងតាមដានសមតុល្យអតិថិជននីមួយៗ។') },
                { icon: Printer, t: tx('KHQR & thermal receipts', 'KHQR និងវិក្កយបត្រកម្តៅ'), d: tx('Accept KHQR payments and print to 58/80mm Bluetooth printers.', 'ទទួល KHQR និងបោះពុម្ពលើម៉ាស៊ីន Bluetooth 58/80mm។') },
                { icon: BarChart3, t: tx('Profit & expense reports', 'របាយការណ៍ចំណេញ'), d: tx('See income, expenses, VAT, and net profit at a glance.', 'មើលចំណូល ចំណាយ ពន្ធ និងប្រាក់ចំណេញសុទ្ធភ្លាមៗ។') },
              ].map((it, i) => (
                <li key={i} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm text-brand-600 flex items-center justify-center"><it.icon size={18} /></div>
                  <div>
                    <p className={`font-bold text-slate-900 ${km ? 'font-display' : ''}`}>{it.t}</p>
                    <p className="text-sm text-slate-500">{it.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-accent-500/20 rounded-[2.5rem] blur-2xl" />
            <div className="relative bg-gradient-to-br from-indigo-900 to-brand-600 rounded-[2.5rem] p-8 shadow-2xl text-white">
              <div className="flex items-center justify-between mb-6">
                <Logo className="w-9 h-9" textClassName="text-base text-white" />
                <span className="text-[10px] font-bold bg-white/15 px-2.5 py-1 rounded-full">PWA</span>
              </div>
              <div className="space-y-3">
                {[
                  { l: tx('Today\'s Sales', 'ការលក់ថ្ងៃនេះ'), v: '1,250,000 ៛', c: 'text-teal-300' },
                  { l: tx('Transactions', 'ប្រតិបត្តិការ'), v: '48', c: 'text-white' },
                  { l: tx('Net Profit', 'ប្រាក់ចំណេញ'), v: '+ 420,000 ៛', c: 'text-amber-300' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/10 rounded-2xl px-5 py-4 backdrop-blur-md border border-white/10">
                    <span className={`text-brand-100 text-sm ${km ? 'font-display' : ''}`}>{r.l}</span>
                    <span className={`font-black text-lg ${r.c}`}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-brand-100">
                <Sparkles size={14} className="text-amber-300" />
                {tx('“Your best day this week! Restock coffee soon.” — AI', '“ថ្ងៃល្អបំផុតសប្តាហ៍នេះ! គួរបញ្ជាទិញកាហ្វេបន្ថែម។” — AI')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="max-w-6xl mx-auto px-5 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-brand-600 font-bold text-sm uppercase tracking-wider mb-2">{tx('Get running in minutes', 'ចាប់ផ្តើមក្នុងពេលប៉ុន្មាននាទី')}</p>
          <h2 className={`text-3xl md:text-4xl font-black text-slate-900 ${km ? 'font-display' : ''}`}>{tx('How it works', 'របៀបប្រើ')}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-brand-500/30">{s.n}</div>
              <h3 className={`font-bold text-lg text-slate-900 mb-2 ${km ? 'font-display' : ''}`}>{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- PRICING / FREE ---------- */}
      <section id="pricing" className="max-w-4xl mx-auto px-5 pb-20 md:pb-28">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-900 via-brand-700 to-brand-600 p-10 md:p-14 text-center text-white shadow-2xl">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-sm font-bold mb-5">
              <Star size={14} className="text-amber-300" /> {tx('Free Forever', 'ឥតគិតថ្លៃជារៀងរហូត')}
            </span>
            <h2 className={`text-3xl md:text-5xl font-black mb-4 ${km ? 'font-display' : ''}`}>{tx('0 ៛ / month', '០ ៛ / ខែ')}</h2>
            <p className={`max-w-xl mx-auto text-brand-100/90 text-lg mb-8 leading-relaxed ${km ? 'font-display' : ''}`}>
              {tx(
                'Haang is a community project — free for every SME in Cambodia. We sustain it through community support, donations, grants, and training. No hidden fees, no lock-in.',
                'Haang ជាគម្រោងសហគមន៍ — ឥតគិតថ្លៃសម្រាប់ SME គ្រប់រូបនៅកម្ពុជា។ យើងទ្រទ្រង់វាតាមរយៈការគាំទ្រ ការបរិច្ចាគ ជំនួយ និងការបណ្តុះបណ្តាល។'
              )}
            </p>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-brand-700 font-bold text-base hover:bg-brand-50 shadow-xl transition-all active:scale-95"
            >
              {tx('Create your free shop', 'បង្កើតហាងឥតគិតថ្លៃ')} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <Logo className="w-9 h-9" textClassName="text-lg text-white" />
              <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-xs">
                {tx(
                  'A free, open-source POS & inventory app for Cambodian small businesses.',
                  'កម្មវិធី POS និងស្តុកទំនិញ ឥតគិតថ្លៃ បើកចំហ សម្រាប់អាជីវកម្មខ្មែរ។'
                )}
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-4">{tx('Product', 'ផលិតផល')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">{tx('Features', 'មុខងារ')}</a></li>
                <li><a href="#how" className="hover:text-white transition-colors">{tx('How it works', 'របៀបប្រើ')}</a></li>
                <li><a href="?mode=manual" className="hover:text-white transition-colors">{tx('User Manual', 'សៀវភៅណែនាំ')}</a></li>
                <li><button onClick={onGetStarted} className="hover:text-white transition-colors">{tx('Sign In', 'ចូលប្រើ')}</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-4">{tx('Community', 'សហគមន៍')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="?mode=license" className="hover:text-white transition-colors">{tx('Community License', 'អាជ្ញាប័ណ្ណសហគមន៍')}</a></li>
                <li><span className="text-slate-400">{tx('Open source · Apache 2.0', 'បើកចំហ · Apache 2.0')}</span></li>
                <li><span className="text-slate-400">{tx('Support · Donations · Training', 'គាំទ្រ · បរិច្ចាគ · បណ្តុះបណ្តាល')}</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 Little Tony · {tx('Haang. All rights reserved.', 'Haang. រក្សាសិទ្ធិគ្រប់យ៉ាង។')}</p>
            <p className="flex items-center gap-1.5 text-center">
              {tx('Incubated by', 'ស្ថិតក្រោមការគាំទ្រ')}{' '}
              <span className="text-slate-200 font-semibold">CamboVerse Center, National University of Management (NUM)</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
