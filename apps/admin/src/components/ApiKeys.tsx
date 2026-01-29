'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ApiKeysProps {
  token: string;
}

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

const AVAILABLE_SCOPES = [
  { value: 'send:email', label: 'Send Emails', description: 'Send emails via API' },
  { value: 'templates:read', label: 'Read Templates', description: 'View templates' },
  { value: 'templates:write', label: 'Write Templates', description: 'Create and edit templates' },
  { value: 'logs:read', label: 'Read Logs', description: 'View message logs' },
  { value: 'webhooks:read', label: 'Read Webhooks', description: 'View webhooks' },
  { value: 'webhooks:write', label: 'Write Webhooks', description: 'Create and edit webhooks' },
  { value: 'domains:read', label: 'Read Domains', description: 'View domains' },
  { value: 'domains:write', label: 'Write Domains', description: 'Create and edit domains' },
];

export default function ApiKeys({ token }: ApiKeysProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['send:email']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, [token]);

  const fetchApiKeys = async () => {
    try {
      const response = await apiFetch('/v1/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setApiKeys(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/v1/api-keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newKeyName,
          scopes: selectedScopes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCreatedKey(data.data.key);
        setShowCopyModal(true);
        setShowCreateForm(false);
        setNewKeyName('');
        setSelectedScopes(['send:email']);
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiFetch(`/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 204) {
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {showCreateForm ? 'Cancel' : 'Create API Key'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Production API Key"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope.value}
                    className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{scope.label}</p>
                      <p className="text-sm text-gray-500">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={selectedScopes.length === 0 || !newKeyName}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              Create API Key
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scopes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apiKeys.map((apiKey) => (
              <tr key={apiKey.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{apiKey.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex flex-wrap gap-1">
                    {apiKey.scopes.map((scope) => (
                      <span key={scope} className="px-2 py-1 bg-gray-100 text-xs rounded">
                        {scope}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(apiKey.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => handleRevoke(apiKey.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {apiKeys.length === 0 && (
          <div className="text-center py-12 text-gray-500">No API keys found</div>
        )}
      </div>

      {showCopyModal && createdKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Created!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Copy this API key now. You will not be able to see it again!
            </p>
            <div className="bg-gray-100 p-4 rounded-lg mb-4">
              <code className="text-sm break-all font-mono">{createdKey}</code>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => copyToClipboard(createdKey)}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
