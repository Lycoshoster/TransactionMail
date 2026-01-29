'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface WebhooksProps {
  token: string;
}

interface Webhook {
  id: string;
  url: string;
  eventTypes: string[];
  active: boolean;
  successCount: number;
  failCount: number;
  lastTriggeredAt: string | null;
}

export default function Webhooks({ token }: WebhooksProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebhooks();
  }, [token]);

  const fetchWebhooks = async () => {
    try {
      const response = await apiFetch('/v1/webhooks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setWebhooks(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Webhooks</h2>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success/Failed</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {webhooks.map((webhook) => (
              <tr key={webhook.id}>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{webhook.url}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{webhook.eventTypes.join(', ')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${webhook.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {webhook.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {webhook.successCount} / {webhook.failCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {webhooks.length === 0 && (
          <div className="text-center py-12 text-gray-500">No webhooks configured</div>
        )}
      </div>
    </div>
  );
}
