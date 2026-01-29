'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: 'overview' | 'messages' | 'templates' | 'webhooks' | 'domains' | 'apikeys') => void;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'messages', label: 'Messages', icon: '📧' },
  { id: 'templates', label: 'Templates', icon: '📝' },
  { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
  { id: 'domains', label: 'Domains', icon: '🌐' },
  { id: 'apikeys', label: 'API Keys', icon: '🔑' },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-full md:w-64 flex-shrink-0">
      <nav className="bg-white shadow rounded-lg">
        <ul className="divide-y divide-gray-200">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => onTabChange(tab.id as any)}
                className={`w-full px-6 py-4 text-left flex items-center space-x-3 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
