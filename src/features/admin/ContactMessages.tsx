"use client";

import { useEffect, useState } from 'react';
import { Search, Mail, Phone, FileText, Clock, CheckCircle, MessageCircle, XCircle } from 'lucide-react';
import { AdminPageHeader, AdminPanel, AdminTablePagination, AdminTableShell } from '../../components/admin/AdminUI';
import { useAdminTablePagination } from '../../hooks/useAdminTablePagination';
import Select from '../../components/ui/Select';
import { toastError, toastSuccess } from '../../lib/toast';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_ROW_OPTIONS = STATUS_FILTER_OPTIONS.filter((o) => o.value !== '');

export default function AdminContactMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  useEffect(() => {
    void loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const { fetchContactMessages } = await import('../../lib/api');
      const data = await fetchContactMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      toastError('Could not load contact messages.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    if (updatingStatusId != null) return;
    setUpdatingStatusId(id);
    try {
      const { updateContactMessageStatus } = await import('../../lib/api');
      await updateContactMessageStatus(id, status);
      void loadMessages();
      toastSuccess('Status updated');
    } catch (err) {
      console.error('Error:', err);
      toastError('Could not update status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const filtered = messages.filter((m) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q) ||
      m.phone?.includes(searchTerm);
    const matchesStatus = !statusFilter || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { page, setPage, pageItems, totalPages, startItem, endItem, totalItems } =
    useAdminTablePagination(filtered, searchTerm, statusFilter);

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string }> = {
    new: { icon: Clock, color: 'text-[#FF7A00]', bgColor: 'bg-[#FF7A00]/12' },
    read: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    replied: { icon: MessageCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
    closed: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <AdminPageHeader
        title="Contact Messages"
        subtitle="Messages submitted from the website contact form"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <StatCard title="New" count={messages.filter((m) => m.status === 'new').length} color="blue" />
        <StatCard title="Read" count={messages.filter((m) => m.status === 'read').length} color="yellow" />
        <StatCard title="Replied" count={messages.filter((m) => m.status === 'replied').length} color="green" />
        <StatCard title="Total" count={messages.length} color="gray" />
      </div>

      <AdminPanel className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
          />
        </div>
      </AdminPanel>

      <AdminTableShell>
        <div className="overflow-x-auto overflow-y-visible touch-pan-x min-w-0 admin-table-scroll">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Message</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF7A00] mx-auto" />
                  </td>
                </tr>
              ) : pageItems.length > 0 ? (
                pageItems.map((m) => {
                  const config = statusConfig[m.status] || statusConfig.new;
                  const Icon = config.icon;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <p className="font-medium text-slate-900">{m.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-sm text-gray-700">
                          <a href={`mailto:${m.email}`} className="flex items-center gap-2 hover:text-[#FF7A00]">
                            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                            {m.email}
                          </a>
                          {m.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                              {m.phone}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 max-w-[12rem]">
                        <p className="line-clamp-2">{m.subject}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-gray-700 max-w-xs line-clamp-3">{m.message}</p>
                        </div>
                      </td>
                      <td className="relative z-20 min-w-[8.5rem] overflow-visible px-6 py-4 whitespace-nowrap">
                        <Select
                          size="sm"
                          dropdownPosition="above"
                          options={STATUS_ROW_OPTIONS}
                          value={m.status || 'new'}
                          onChange={(v) => updateStatus(m.id, v)}
                          disabled={updatingStatusId === m.id}
                          triggerClassName={`rounded-full border-0 shadow-none ring-0 ${config.bgColor} ${config.color}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <a
                          href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || '')}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF7A00] text-white text-sm rounded-[10px] hover:bg-[#e86e00]"
                        >
                          <Mail className="w-4 h-4" />
                          Reply
                        </a>
                        {m.phone ? (
                          <a
                            href={`tel:${m.phone}`}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-gray-200 text-sm rounded-[10px] hover:bg-gray-50"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No contact messages found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminTablePagination
          enabled={!loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          startItem={startItem}
          endItem={endItem}
          totalItems={totalItems}
        />
      </AdminTableShell>
    </div>
  );
}

function StatCard({ title, count, color }: { title: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    gray: 'bg-gray-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-4 sm:p-[17px] min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{count}</p>
        </div>
        <div className={`w-12 h-12 ${colors[color]} rounded-lg flex items-center justify-center`}>
          <CheckCircle className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
