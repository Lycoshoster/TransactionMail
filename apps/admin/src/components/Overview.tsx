'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface OverviewProps {
  token: string;
}

interface Stats {
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  totalProjects: number;
  totalTemplates: number;
}

export default function Overview({ token }: OverviewProps) {
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    sentMessages: 0,
    failedMessages: 0,
    totalProjects: 0,
    totalTemplates: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [token]);

  const fetchStats = async () => {
    try {
      const messagesRes = await apiFetch('/v1/messages?limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const templatesRes = await apiFetch('/v1/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const messagesData = await messagesRes.json();
      const templatesData = await templatesRes.json();

      setStats({
        totalMessages: messagesData.meta?.pagination?.total || 0,
        sentMessages: 0,
        failedMessages: 0,
        totalProjects: 1,
        totalTemplates: templatesData.data?.length || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Messages', value: stats.totalMessages, color: 'bg-blue-500' },
    { label: 'Sent', value: stats.sentMessages, color: 'bg-green-500' },
    { label: 'Failed', value: stats.failedMessages, color: 'bg-red-500' },
    { label: 'Templates', value: stats.totalTemplates, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <div className={`w-12 h-12 ${card.color} rounded-lg mb-4`}></div>
            <p className="text-sm font-medium text-gray-600">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="http://localhost:3000/documentation"
            target="_blank"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-2xl mr-3">📚</span>
            <div>
              <p className="font-medium text-gray-900">API Documentation</p>
              <p className="text-sm text-gray-500">View Swagger/OpenAPI docs</p>
            </div>
          </a>
          <div className="flex items-center p-4 border border-gray-200 rounded-lg">
            <span className="text-2xl mr-3">🔑</span>
            <div>
              <p className="font-medium text-gray-900">API Keys</p>
              <p className="text-sm text-gray-500">Manage your API credentials</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
