'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import Sidebar from './Sidebar';
import Overview from './Overview';
import Messages from './Messages';
import Templates from './Templates';
import Webhooks from './Webhooks';
import Domains from './Domains';
import ApiKeys from './ApiKeys';

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

type Tab = 'overview' | 'messages' | 'templates' | 'webhooks' | 'domains' | 'apikeys';

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    apiFetch('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
        }
      });
  }, [token]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview token={token} />;
      case 'messages':
        return <Messages token={token} />;
      case 'templates':
        return <Templates token={token} />;
      case 'webhooks':
        return <Webhooks token={token} />;
      case 'domains':
        return <Domains token={token} />;
      case 'apikeys':
        return <ApiKeys token={token} />;
      default:
        return <Overview token={token} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">TransactionMail Admin</h1>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-gray-600">
                  {user.email} ({user.role})
                </span>
              )}
              <button
                onClick={onLogout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Main Content */}
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
