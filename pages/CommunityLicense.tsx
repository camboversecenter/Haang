
import React from 'react';
import { Logo } from '../components/Logo';
import { ArrowLeft } from 'lucide-react';

export default function CommunityLicense() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-brand-900 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Logo className="w-12 h-12" textClassName="text-2xl text-white" />
                        <h1 className="text-2xl md:text-3xl font-bold mt-4 font-display">
                            🛡️ អាជ្ញាប័ណ្ណសហគមន៍
                        </h1>
                        <p className="text-brand-200 font-bold opacity-80 mt-1">
                            Community License
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                         <p className="text-xs font-bold text-brand-200 uppercase tracking-wider">License / អាជ្ញាប័ណ្ណ</p>
                         <p className="font-bold text-white">Open Source · Apache 2.0</p>
                    </div>
                </div>
            </div>

            <div className="p-8 md:p-12 space-y-10 text-gray-700">
                <section>
                    <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">1</span>
                        សិទ្ធិប្រើប្រាស់ និងការគាំទ្រ (Usage & Support)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            កម្មវិធីនេះអនុញ្ញាតឱ្យប្រើប្រាស់ដោយ <span className="text-green-600 font-bold">ឥតគិតថ្លៃ (Free to Use)</span> សម្រាប់សហគ្រាសធុនតូច និងមធ្យម (SME) នៅកម្ពុជា។ ដើម្បីផ្គត់ផ្គង់ការចំណាយលើប្រតិបត្តិការ និងការអភិវឌ្ឍ គម្រោងនេះទទួលបានការគាំទ្រតាមរយៈការបរិច្ចាគ (Donations), ជំនួយឧបត្ថម្ភ (Grants), ការបណ្តុះបណ្តាល (Training) និងសេវាកម្មគាំទ្រ (Support)។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (This app is free to use for SMEs in Cambodia. To cover operating and development costs, the project is sustained through community donations, grants, training, and support services — not by selling the software.)
                        </p>
                    </div>
                </section>

                <section>
                     <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">2</span>
                        កូដបើកចំហ & អាជ្ញាប័ណ្ណ (Open Source & License)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            កូដប្រភព (Source Code) ត្រូវបានចេញផ្សាយជាសាធារណៈ (Open Source) ក្រោមអាជ្ញាប័ណ្ណ <span className="font-bold">Apache License 2.0</span>។ អ្នករាល់គ្នាមានសិទ្ធិប្រើប្រាស់ ចម្លង កែប្រែ និងចែកចាយកូដ ដោយគ្រាន់តែរក្សាការជូនដំណឹងអំពីកម្មសិទ្ធិ (Copyright Notice) ប៉ុណ្ណោះ។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (The source code is released as open source under the Apache License 2.0. Anyone is free to use, copy, modify, and distribute it — including commercially — provided they keep the copyright and attribution notices.)
                        </p>
                    </div>
                </section>

                <section>
                     <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">3</span>
                        ឈ្មោះ និងម៉ាកសញ្ញា (Brand & Trademark)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            កូដគឺបើកចំហ ប៉ុន្តែឈ្មោះ និងឡូហ្គោ "Haang" / "Little Tony" ត្រូវបានរក្សាសិទ្ធិជាម៉ាកសញ្ញា។ ការចម្លងកូដ (Fork) ត្រូវប្រើឈ្មោះ និងម៉ាកសញ្ញាផ្ទាល់ខ្លួន ដើម្បីកុំឱ្យមានការភាន់ច្រឡំជាមួយគម្រោងផ្លូវការ។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (The code is open, but the "Haang" / "Little Tony" name and logo are reserved trademarks and are not granted by the Apache 2.0 license. Forks must use their own distinct name and branding to avoid confusion with the official project.)
                        </p>
                    </div>
                </section>

                <section>
                     <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">4</span>
                        ការបដិសេធការទទួលខុសត្រូវ (Limitation of Liability)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            កម្មវិធីនេះត្រូវបានផ្តល់ជូន "ដូចដែលបានមាន" (AS IS) ដោយគ្មានការធានាណាមួយឡើយ។ គម្រោង Haang (Little Tony) មិនទទួលខុសត្រូវចំពោះការបាត់បង់ទិន្នន័យ ឬទ្រព្យសម្បត្តិណាមួយដែលកើតឡើងពីការប្រើប្រាស់កម្មវិធីនេះឡើយ។ អ្នកប្រើប្រាស់ត្រូវទទួលខុសត្រូវដោយខ្លួនឯង។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (The software is provided "AS IS" without warranty of any kind, consistent with the Apache License 2.0. The Haang (Little Tony) project is not liable for any damages or losses arising from the use of this platform. Users assume full responsibility.)
                        </p>
                    </div>
                </section>
            </div>

            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
                 <a href="/" className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
                    <ArrowLeft size={20} />
                    Back to Home
                 </a>
            </div>
        </div>
    </div>
  );
}
