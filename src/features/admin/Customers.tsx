"use client";

import { useEffect, useState } from 'react';
import { Search, Mail, Phone, MapPin } from 'lucide-react';
import { AdminPageHeader, AdminPanel, AdminTablePagination, AdminTableShell } from '../../components/admin/AdminUI';
import { useAdminTablePagination } from '../../hooks/useAdminTablePagination';
import { toastError } from '../../lib/toast';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { fetchCustomers: apiFetchCustomers } = await import('../../lib/api');
      const data = await apiFetchCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      toastError('Could not load customers.');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const sourceLabel = (source: string | undefined) => {
    if (source === 'account_checkout') return 'Account + checkout';
    if (source === 'account') return 'Account';
    return 'Checkout';
  };

  const {
    page,
    setPage,
    pageItems,
    totalPages,
    startItem,
    endItem,
    totalItems,
  } = useAdminTablePagination(filteredCustomers, searchTerm);

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {/* Header */}
      <AdminPageHeader title="Customers" subtitle="Manage your customer base" />

      {/* Search */}
      <AdminPanel className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 border border-gray-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </AdminPanel>

      {/* Customers Table */}
      <AdminTableShell>
        <div className="overflow-x-auto overflow-y-visible touch-pan-x min-w-0 admin-table-scroll">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF7A00] mx-auto" />
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                pageItems.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#FF7A00]/10 rounded-full flex items-center justify-center text-[#FF7A00] font-bold">
                          {customer.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 whitespace-nowrap">{customer.name || 'Customer'}</p>
                          {customer.email_verified === false ? (
                            <p className="mt-0.5 text-xs font-medium text-amber-600">Email pending</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{customer.email}</span>
                        </div>
                        {customer.phone ? (
                          <div className="flex items-center space-x-2 text-sm text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{customer.city || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {sourceLabel(customer.source)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No customers found</td>
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
