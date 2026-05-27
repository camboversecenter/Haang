
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
                         <p className="text-xs font-bold text-brand-200 uppercase tracking-wider">Phase / ស្ថានភាព</p>
                         <p className="font-bold text-white">Development & Pre-Token</p>
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
                            កម្មវិធីនេះអនុញ្ញាតឱ្យប្រើប្រាស់ដោយ <span className="text-green-600 font-bold">ឥតគិតថ្លៃ (Free to Use)</span>។ ដើម្បីផ្គត់ផ្គង់ការចំណាយលើប្រតិបត្តិការ និងការអភិវឌ្ឍ ក្រុមហ៊ុន E-KHMER Technology Co., Ltd. ស្វាគមន៍រាល់ការបរិច្ចាគ (Donations) និងរក្សាសិទ្ធិក្នុងការរកប្រាក់ចំណូលតាមរយៈការផ្សព្វផ្សាយពាណិជ្ជកម្ម (Ads) ឬសេវាកម្មផ្សេងៗ។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (Users may use this platform for free. To cover development and operating costs, E-KHMER Technology Co., Ltd. welcomes donations and reserves the right to monetize via advertisements or other services.)
                        </p>
                    </div>
                </section>

                <section>
                     <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">2</span>
                        កម្មសិទ្ធិបច្ចុប្បន្ន (Current Ownership)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            បច្ចុប្បន្ននេះ កម្មវិធីនិងកូដ (Source Code) ត្រូវបានអភិវឌ្ឍនិងថែរក្សាដោយក្រុមហ៊ុន E-KHMER Technology Co., Ltd.។ ដើម្បីធានាសុវត្ថិភាពមុនពេលលក់ Token កូដត្រូវបានរក្សាទុកជាឯកជន (Closed Source)។ ហាមដាច់ខាតការចម្លង ឬបំបែកកូដ (Reverse Engineering) ដោយគ្មានការអនុញ្ញាត។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (Currently, the source code is proprietary and maintained by E-KHMER Technology Co., Ltd. for security purposes. Reverse engineering or unauthorized copying is strictly prohibited.)
                        </p>
                    </div>
                </section>

                <section>
                     <h2 className="text-xl font-bold text-brand-900 mb-4 font-display flex items-center gap-2">
                        <span className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 text-sm font-sans">3</span>
                        ការសន្យាអនាគត & Token Sale (Future Transition)
                    </h2>
                    <div className="pl-10 space-y-2">
                        <p className="leading-relaxed font-display">
                            នេះជាកិច្ចសន្យារបស់យើង៖ នៅពេលការលក់ Token (Token Sale) បានបញ្ចប់ជាស្ថាពរ ក្រុមហ៊ុននឹងដាក់ឱ្យប្រើប្រាស់កូដជាសាធារណៈ (Open Source) ក្រោមអាជ្ញាប័ណ្ណ Apache License 2.0។ នៅពេលនោះ ការសម្រេចចិត្តនឹងត្រូវធ្វើឡើងតាមរយៈសហគមន៍ (Community Decision/DAO)។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (We pledge to release the source code under the Apache License 2.0 upon completion of the Token Sale. Governance rights will then transfer to the Community.)
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
                            កម្មវិធីនេះត្រូវបានផ្តល់ជូន "ដូចដែលបានមាន" (AS IS) ដោយគ្មានការធានាណាមួយឡើយ។ ក្រុមហ៊ុន E-KHMER Technology Co., Ltd. មិនទទួលខុសត្រូវចំពោះការបាត់បង់ទិន្នន័យ ឬទ្រព្យសម្បត្តិណាមួយដែលកើតឡើងពីការប្រើប្រាស់កម្មវិធីនេះឡើយ។ អ្នកប្រើប្រាស់ត្រូវទទួលខុសត្រូវដោយខ្លួនឯង។
                        </p>
                        <p className="text-sm text-gray-500 italic">
                            (The software is provided "AS IS" without warranty of any kind. E-KHMER Technology Co., Ltd. is not liable for any damages or losses arising from the use of this platform. Users assume full responsibility.)
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
