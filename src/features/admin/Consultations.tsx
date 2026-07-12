"use client";

import { useEffect, useState } from 'react';
import { Search, Phone, MapPin, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { AdminPageHeader, AdminPanel, AdminTablePagination, AdminTableShell } from '../../components/admin/AdminUI';
import { useAdminTablePagination } from '../../hooks/useAdminTablePagination';
import Select from '../../components/ui/Select';
import { toastError, toastSuccess } from '../../lib/toast';

const CONSULTATION_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const CONSULTATION_STATUS_ROW_OPTIONS = CONSULTATION_STATUS_FILTER_OPTIONS.filter((o) => o.value !== '');

export default function AdminConsultations() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      const { fetchConsultations: apiFetchConsultations } = await import('../../lib/api');
      const data = await apiFetchConsultations();
      setConsultations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      toastError('Could not load consultations.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    if (updatingStatusId != null) return;
    setUpdatingStatusId(id);
    try {
      const { updateConsultationStatus } = await import('../../lib/api');
      await updateConsultationStatus(id, status);
      fetchConsultations();
      toastSuccess('Status updated');
    } catch (err) {
      console.error('Error:', err);
      toastError('Could not update status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const filteredConsultations = consultations.filter(consultation => {
    const matchesSearch =
      consultation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultation.phone?.includes(searchTerm) ||
      consultation.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || consultation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    startItem,
    endItem,
    totalItems,
  } = useAdminTablePagination(filteredConsultations, searchTerm, statusFilter);

  const statusConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
    new: { icon: Clock, color: 'text-[#FF7A00]', bgColor: 'bg-[#FF7A00]/12' },
    contacted: { icon: Phone, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    converted: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
    closed: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Header */}
      <AdminPageHeader
        title="Consultation Leads"
        subtitle="Manage solar consultation requests"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <StatCard title="New Leads" count={consultations.filter(c => c.status === 'new').length} color="blue" />
        <StatCard title="Contacted" count={consultations.filter(c => c.status === 'contacted').length} color="yellow" />
        <StatCard title="Converted" count={consultations.filter(c => c.status === 'converted').length} color="green" />
        <StatCard title="Total Leads" count={consultations.length} color="gray" />
      </div>

      {/* Filters */}
      <AdminPanel className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/35"
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select
            options={CONSULTATION_STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All Status"
          />
        </div>
      </AdminPanel>

      {/* Consultations Table */}
      <AdminTableShell>
        <div className="overflow-x-auto overflow-y-visible touch-pan-x min-w-0 admin-table-scroll">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Lead</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Monthly Bill</th>
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
              ) : filteredConsultations.length > 0 ? (
                pageItems.map(consultation => {
                  const config = statusConfig[consultation.status] || statusConfig.new;
                  const Icon = config.icon;
                  return (
                    <tr key={consultation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 whitespace-nowrap">{consultation.name}</p>
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              <MapPin className="w-3 h-3" />
                              <span>{consultation.city}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{consultation.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {consultation.monthly_bill ? `Rs. ${consultation.monthly_bill}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-2">
                          <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700 max-w-xs line-clamp-2">{consultation.message}</p>
                        </div>
                      </td>
                      <td className="relative z-20 min-w-[8.5rem] overflow-visible px-6 py-4 whitespace-nowrap">
                        <Select
                          size="sm"
                          dropdownPosition="above"
                          options={CONSULTATION_STATUS_ROW_OPTIONS}
                          value={consultation.status || 'new'}
                          onChange={(v) => updateStatus(consultation.id, v)}
                          disabled={updatingStatusId === consultation.id}
                          triggerClassName={`rounded-full border-0 shadow-none ring-0 ${config.bgColor} ${config.color}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(consultation.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`tel:${consultation.phone}`}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-[#FF7A00] text-white text-sm rounded-[10px] hover:bg-[#e86e00] transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          <span>Call</span>
                        </a>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No consultation leads found</td>
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
    gray: 'bg-gray-500'
  };
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-4 sm:p-[17px] min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{count}</p>
        </div>
        <div className={`w-12 h-12 ${colors[color]} rounded-lg flex items-center justify-center`}>
          <FileText className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
