'use client';

import Link from 'next/link';
import EfsForm from '../../components/efs/EfsForm';

export default function ExternalFirespreadPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <div className="container mx-auto px-6 py-8 flex-1">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tools
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            External Fire Spread Calculator
          </h1>
          <p className="text-gray-600 text-sm mt-2">
            BRE 135 external fire spread assessment for building elevations.
          </p>
        </div>

        <EfsForm />
      </div>

      <footer className="bg-blue-300 text-white py-6 px-6">
        <div className="container mx-auto">
          <h2 className="text-2xl font-semibold mb-1">Fire Dynamics</h2>
          <p className="text-sm">&copy; 2022 Fire Dynamics Group Limited | Company number: 13476929</p>
        </div>
      </footer>
    </div>
  );
}
