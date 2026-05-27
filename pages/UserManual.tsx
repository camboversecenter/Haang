
import React from 'react';
import { Logo } from '../components/Logo';
import { ArrowLeft, BookOpen, ShoppingCart, Package, Utensils, BarChart3, Settings, ChefHat, Users, Printer, Database, Trash2 } from 'lucide-react';

export default function UserManual() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-y-auto font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" textClassName="text-lg" />
            <span className="text-gray-300">|</span>
            <h1 className="font-display font-bold text-lg text-slate-800">សៀវភៅណែនាំ</h1>
          </div>
          <a href="/" className="flex items-center gap-2 text-sm font-bold text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-xl transition-colors">
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">ត្រឡប់ទៅវិញ</span>
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-12">
        
        {/* Intro */}
        <section className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-brand-900 leading-tight">
            របៀបប្រើប្រាស់ប្រព័ន្ធ HAANG
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
            សូមស្វាគមន៍មកកាន់ប្រព័ន្ធគ្រប់គ្រងហាងឆ្លាតវៃ។ ឯកសារនេះនឹងណែនាំអ្នកអំពីមុខងារសំខាន់ៗដើម្បីជួយឱ្យអាជីវកម្មរបស់អ្នកដំណើរការដោយរលូន។
          </p>
        </section>

        {/* 1. ការចាប់ផ្តើម */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <BookOpen size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">១. ការចាប់ផ្តើម (Getting Started)</h3>
          </div>
          <ul className="space-y-4 text-slate-700 leading-loose list-disc pl-5">
            <li><strong className="text-brand-700">ការបង្កើតហាង៖</strong> នៅពេលចូលដំបូង សូមវាយឈ្មោះហាង និងជ្រើសរើសប្រភេទអាជីវកម្មរបស់អ្នក (លក់រាយ ឬ ភោជនីយដ្ឋាន)។</li>
            <li><strong className="text-brand-700">ចូលគណនី (Login)៖</strong> ម្ចាស់ហាង (Owner) ចូលប្រើតាមរយៈ Google Account។ បុគ្គលិក (Staff) ចូលប្រើដោយលេខទូរស័ព្ទហាង និងលេខកូដ PIN (៤ខ្ទង់)។</li>
            <li><strong className="text-brand-700">ប្តូរភាសា៖</strong> អ្នកអាចប្តូរភាសា (ខ្មែរ/English) នៅជ្រុងខាងលើ ឬក្នុងផ្នែក Setting។</li>
          </ul>
        </div>

        {/* 2. ការលក់ POS */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
              <ShoppingCart size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">២. ការលក់ (POS)</h3>
          </div>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <p>នេះជាកន្លែងសម្រាប់អ្នកគិតលុយ (Cashier)៖</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>ជ្រើសរើសទំនិញ៖</strong> ចុចលើរូបទំនិញដើម្បីដាក់ចូលកន្ត្រក។ បើទំនិញមានជម្រើស (Variants) សូមជ្រើសរើសប្រភេទ (ឧ. ទំហំ, ពណ៌)។</li>
              <li><strong>ស្កេនបាកូដ៖</strong> ចុចលើរូបកាមេរ៉ា ឬប្រើម៉ាស៊ីនស្កេន ដើម្បីលក់រហ័ស។</li>
              <li><strong>បញ្ចុះតម្លៃ៖</strong> ប្រព័ន្ធនឹងគណនាការបញ្ចុះតម្លៃដោយស្វ័យប្រវត្តិប្រសិនបើមាន។</li>
              <li><strong>ការទូទាត់៖</strong> ចុច "Pay" រួចជ្រើសរើសវិធីបង់ប្រាក់ (Cash, KHQR, ឬ ជំពាក់)។</li>
              <li><strong>ការបោះពុម្ព៖</strong> ក្រោយពេលគិតលុយ អ្នកអាចបោះពុម្ពវិក្កយបត្រតាមរយៈ Bluetooth Printer។</li>
            </ul>
          </div>
        </div>

        {/* 3. គ្រប់គ្រងស្តុក */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <Package size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">៣. គ្រប់គ្រងស្តុក (Inventory)</h3>
          </div>
          <div className="space-y-4 text-slate-700 leading-relaxed">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>បន្ថែមទំនិញថ្មី៖</strong> ចុចប៊ូតុង (+) បំពេញឈ្មោះ តម្លៃ និងចំនួនស្តុក។ អ្នកអាចប្រើ AI ដើម្បីបង្កើតរូបភាពទំនិញបាន។</li>
              <li><strong>បាកូដ៖</strong> ស្កេនបាកូដនៅលើផលិតផលដើម្បីរក្សាទុក។</li>
              <li><strong>ប្រភេទ (Category)៖</strong> បង្កើតប្រភេទដើម្បីងាយស្រួលស្វែងរក។</li>
              <li><strong>តាមដានស្តុក៖</strong> ប្រព័ន្ធនឹងជូនដំណឹងនៅពេលទំនិញជិតអស់ (Low Stock)។</li>
            </ul>
          </div>
        </div>

        {/* 4. សម្រាប់ភោជនីយដ្ឋាន */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
              <Utensils size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">៤. សម្រាប់ភោជនីយដ្ឋាន (Tables & Kitchen)</h3>
          </div>
          <div className="space-y-6 text-slate-700 leading-relaxed">
            <div>
              <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><Utensils size={16}/> ការគ្រប់គ្រងតុ (Tables)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>បង្កើតតុ និងកំណត់ចំនួនកៅអី។</li>
                <li>មើលស្ថានភាពតុ (ទំនេរ/រវល់)។</li>
                <li>ទទួលការកក់ទុក (Booking) ពីអតិថិជន។</li>
                <li>ទទួលសារពីអតិថិជន (ហៅគិតលុយ/ហៅបុគ្គលិក) ពី QR Code លើតុ។</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-brand-700 mb-2 flex items-center gap-2"><ChefHat size={16}/> ផ្ទះបាយ (Kitchen Display)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>ចុងភៅអាចមើលឃើញការកម្ម៉ង់ផ្ទាល់។</li>
                <li>ប្តូរស្ថានភាពពី "កំពុងចម្អិន" ទៅ "រួចរាល់"។</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 5. របាយការណ៍ */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">៥. របាយការណ៍ (Dashboard)</h3>
          </div>
          <p className="text-slate-700 mb-2">មើលទិន្នន័យអាជីវកម្មរបស់អ្នក៖</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-700">
            <li>ចំណូល និងចំណាយប្រចាំថ្ងៃ/ខែ។</li>
            <li>មុខទំនិញលក់ដាច់បំផុត។</li>
            <li><strong>AI Insight:</strong> ប្រើប៊ូតុង "Ask AI" ដើម្បីទទួលបានយោបល់ពី AI ក្នុងការបង្កើនការលក់។</li>
          </ul>
        </div>

        {/* 6. ការកំណត់ */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
              <Settings size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-800">៦. ការកំណត់ (Settings)</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6 text-slate-700">
             <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Users size={16}/> បុគ្គលិក (Staff)</h4>
                <p className="text-sm">បង្កើតគណនីបុគ្គលិក (Cashier, Waiter, Kitchen) និងកំណត់លេខកូដ PIN សម្រាប់ពួកគេ។</p>
             </div>
             <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Printer size={16}/> ម៉ាស៊ីនព្រីន (Hardware)</h4>
                <p className="text-sm">ភ្ជាប់ Bluetooth Thermal Printer (58mm/80mm) ដើម្បីបោះពុម្ពវិក្កយបត្រ។</p>
             </div>
          </div>
        </div>

        {/* 7. ការរក្សាទិន្នន័យ */}
        <div className="bg-red-50 rounded-3xl p-6 md:p-8 shadow-sm border border-red-100">
          <div className="flex items-center gap-4 mb-6 border-b border-red-100 pb-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 border border-red-100">
              <Database size={24} />
            </div>
            <h3 className="text-xl font-display font-bold text-red-900">៧. ការរក្សាទិន្នន័យ (Data Retention)</h3>
          </div>
          <div className="text-red-800 leading-relaxed space-y-4">
            <p>ដើម្បីធានាថាកម្មវិធីដំណើរការលឿននិងមិនពេញទំហំផ្ទុក ប្រព័ន្ធនឹងធ្វើការលុបទិន្នន័យចាស់ៗដោយស្វ័យប្រវត្តិ៖</p>
            <ul className="list-disc pl-5 space-y-2 text-sm font-medium">
                <li>
                    <strong>វិក្កយបត្រជោគជ័យ (Completed Sales):</strong> រក្សាទុក <span className="underline">១ ឆ្នាំ</span>។ ទិន្នន័យដែលចាស់ជាងនេះនឹងត្រូវលុប។
                </li>
                <li>
                    <strong>ការកម្ម៉ង់ដែលមិនជោគជ័យ (Pending/Cancelled):</strong> រក្សាទុក <span className="underline">១ ខែ</span>។
                </li>
                <li>
                    <strong>រូបភាពវិក្កយបត្រ (Payment Proofs):</strong> រក្សាទុក <span className="underline">៣ ខែ</span> ដើម្បីសន្សំសំចៃទំហំផ្ទុក។
                </li>
                <li>
                    <strong>ប្រវត្តិសកម្មភាព (Activity Logs):</strong> រក្សាទុក <span className="underline">៣ ខែ</span>។
                </li>
            </ul>
            <div className="flex items-center gap-2 mt-4 text-xs bg-white/50 p-3 rounded-xl border border-red-100 text-red-600">
                <Trash2 size={16} />
                <span>ចំណាំ៖ សូមធ្វើការ Export ទិន្នន័យលក់ (CSV) ជារៀងរាល់ខែ ប្រសិនបើអ្នកត្រូវការរក្សាទុកឯកសារយូរអង្វែង។</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
