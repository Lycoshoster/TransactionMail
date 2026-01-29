'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface DomainsProps {
  token: string;
}

interface Domain {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string | null;
  status: string;
  spfRecord: string | null;
  dkimRecord: string | null;
  dmarcRecord: string | null;
  dkimSelector: string | null;
  verifiedAt: string | null;
}

export default function Domains({ token }: DomainsProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  useEffect(() => {
    fetchDomains();
  }, [token]);

  const fetchDomains = async () => {
    try {
      const response = await apiFetch('/v1/domains', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setDomains(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch domains:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Domains</h2>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.map((domain) => (
              <tr key={domain.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{domain.domain}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {domain.fromName ? `${domain.fromName} <${domain.fromEmail}>` : domain.fromEmail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(domain.status)}`}>
                    {domain.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => setSelectedDomain(domain)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    View DNS
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {domains.length === 0 && (
          <div className="text-center py-12 text-gray-500">No domains configured</div>
        )}
      </div>

      {selectedDomain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">DNS Records for {selectedDomain.domain}</h3>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedDomain.spfRecord && (
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium mb-2">SPF Record</h4>
                  <code className="text-sm bg-gray-100 p-2 rounded block break-all">{selectedDomain.spfRecord}</code>
                </div>
              )}

              {selectedDomain.dkimRecord && (
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium mb-2">DKIM Record ({selectedDomain.dkimSelector}._domainkey)</h4>
                  <code className="text-sm bg-gray-100 p-2 rounded block break-all">{selectedDomain.dkimRecord}</code>
                </div>
              )}

              {selectedDomain.dmarcRecord && (
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium mb-2">DMARC Record (_dmarc)</h4>
                  <code className="text-sm bg-gray-100 p-2 rounded block break-all">{selectedDomain.dmarcRecord}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
