"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from '@headlessui/react';

const branches = ["Bhayander", "Borivali", "Malad"];
const pageSize = 5;

const TOKEN_KEY = 'doctor_jwt';

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function NurseDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [branch, setBranch] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nurse_branch') || branches[0];
    }
    return branches[0];
  });
  const [date, setDate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nurse_date') || new Date().toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('nurse_page') || '1', 10);
    }
    return 1;
  });
  const [loading, setLoading] = useState(false);
  const [showClosedDaysModal, setShowClosedDaysModal] = useState(false);
  const [closedFromDate, setClosedFromDate] = useState(new Date().toISOString().slice(0,10));
  const [closedToDate, setClosedToDate] = useState(new Date().toISOString().slice(0,10));
  const [closedBranch, setClosedBranch] = useState('All');
  const [closedReason, setClosedReason] = useState('Doctor on leave');
  const [closedDaysList, setClosedDaysList] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingAppointment, setConfirmingAppointment] = useState<any>(null);
  const [confirmingAction, setConfirmingAction] = useState<'collect' | 'uncollect' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);


  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace('/');
      return;
    }
    const payload = parseJwt(token);
    if (payload && payload.role === 'Nurse') {
      setEmail(payload.email);
    } else {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    localStorage.setItem('nurse_branch', branch);
    localStorage.setItem('nurse_date', date);
    localStorage.setItem('nurse_page', page.toString());
  }, [branch, date, page]);

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line
  }, [branch, date, page]);

  useEffect(() => {
    if (showClosedDaysModal) fetchClosedDays();
    // eslint-disable-next-line
  }, [showClosedDaysModal]);

  const fetchAppointments = async () => {
    setLoading(true);
    setAppointments([]);
    const res = await fetch(`/api/nurse/appointments?branch=${encodeURIComponent(branch)}&date=${date}&page=${page}&pageSize=${pageSize}`);
    const data = await res.json();
    setAppointments(data.appointments || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  const fetchClosedDays = async () => {
    try {
      const res = await fetch(`/api/nurse/closed_days`);
      const data = await res.json();
      setClosedDaysList(data.closedDays || []);
    } catch (err) {
      console.error('Failed to fetch closed days', err);
    }
  };

  const handleAddClosedDay = async () => {
    try {
      const payload: any = { branch: closedBranch, reason: closedReason };
      // send date range
      payload.dateFrom = closedFromDate;
      payload.dateTo = closedToDate || closedFromDate;

      const res = await fetch('/api/nurse/closed_days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add closed day');
      setClosedReason('Doctor on leave');
      setClosedBranch('All');
      const today = new Date().toISOString().slice(0,10);
      setClosedFromDate(today);
      setClosedToDate(today);
      await fetchClosedDays();
      alert('Closed day added');
    } catch (err) {
      console.error(err);
      alert('Failed to add closed day');
    }
  };

  const handleRemoveClosedDay = async (id: string) => {
    if (!confirm('Remove this closed day?')) return;
    try {
      const res = await fetch(`/api/nurse/closed_days?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchClosedDays();
      alert('Removed');
    } catch (err) {
      console.error(err);
      alert('Failed to remove closed day');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // TODO: Implement status update API call
    setAppointments((prev) => prev.map(appt => appt.id === id ? { ...appt, status: newStatus } : appt));
  };

  const handleCashCollectionClick = (appt: any) => {
    // default action when clicking on cash item: collect if pending, uncollect if already collected
    setConfirmingAppointment(appt);
    setConfirmingAction(appt.payment === 'cash_collected' ? 'uncollect' : 'collect');
    setShowConfirmModal(true);
  };

  const handleConfirmCashCollection = async () => {
    if (!confirmingAppointment) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/nurse/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitNo: confirmingAppointment.visitNo,
          date: date,
          time: confirmingAppointment.time,
          collected: confirmingAction === 'collect',
        }),
      });

      if (response.ok) {
        // Update UI only after successful API response
        setAppointments((prev) =>
          prev.map((a) =>
            a.visitNo === confirmingAppointment.visitNo
              ? { ...a, payment: confirmingAction === 'collect' ? 'cash_collected' : 'cash' }
              : a
          )
        );
        setShowConfirmModal(false);
        setConfirmingAppointment(null);
        setConfirmingAction(null);
        alert(confirmingAction === 'collect' ? '✓ Cash payment marked as collected!' : '✕ Cash payment marked as not collected');
      } else {
        alert('Failed to update payment status');
        console.error('Failed to update payment status');
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error updating payment status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('doctor_jwt');
    localStorage.removeItem('doctor_token_expiry');
    router.replace('/');
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex flex-col items-center p-4">
      {/* Confirmation Modal for Cash Collection */}
      <Dialog open={showConfirmModal} onClose={() => !isUpdating && setShowConfirmModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <Dialog.Title className="text-xl font-bold text-gray-800 mb-4">
              {confirmingAction === 'uncollect' ? 'Mark Cash Payment as Not Collected?' : 'Mark Cash Payment as Collected?'}
            </Dialog.Title>

            {confirmingAppointment && (
              <>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Patient:</strong> {confirmingAppointment.name}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Time:</strong> {confirmingAppointment.time}
                  </p>
                  <p className="text-sm text-red-700 font-semibold mt-3">
                    ⚠️ This action is permanent. Once changed, the status will be updated in the system.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isUpdating}
                    className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmCashCollection}
                    disabled={isUpdating}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isUpdating ? 'Updating...' : (confirmingAction === 'uncollect' ? 'Yes, Mark as Not Collected' : 'Yes, Mark as Collected')}
                  </button>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>

      <div className="w-full max-w-3xl mt-8 relative">
        <button
          onClick={handleLogout}
          className="absolute right-0 top-0 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
        >
          Log Out
        </button>
        {/* Removed Add and Manual Booking buttons */}
        {/* {showAddModal && (
          <NAddPatientModal
            onClose={() => setShowAddModal(false)}
            onBooked={() => {
              setShowAddModal(false);
              fetchAppointments();
            }}
          />
        )} */}
        <h3 className="text-lg text-align-center font-bold text-gray-800 mb-4 text-start">Nurse Dashboard</h3>
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 flex flex-col gap-4">
          <div className="text-lg text-blue-700 font-semibold">Welcome, {email || 'Nurse'}!</div>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700">Branch:</label>
              <select
                value={branch}
                onChange={e => { setBranch(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700">Date:</label>
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowClosedDaysModal(true)}
                className="bg-red-600 text-white px-3 py-2 rounded-xl font-semibold shadow hover:bg-red-700"
              >
                Manage Closed Days
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Contact</th>
                  <th className="py-2 pr-2">Payment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8">Loading...</td></tr>
                ) : appointments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No appointments found.</td></tr>
                ) : appointments.map(appt => (
                  <tr key={appt.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-mono">{appt.time}</td>
                    <td className="py-2 pr-2">{appt.name}</td>
                    <td className="py-2 pr-2">{appt.contact}</td>
                    <td className="py-2 pr-2">
                      {appt.payment === 'online' ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-green-600 text-white px-3 py-1 rounded font-semibold text-xs">
                            Online
                          </span>
                          <span className="text-green-600 text-xs">✓ Paid</span>
                        </div>
                      ) : appt.payment === 'upi' ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-green-600 text-white px-3 py-1 rounded font-semibold text-xs">
                            UPI
                          </span>
                          <span className="text-green-600 text-xs">✓ Paid</span>
                        </div>
                      ) : appt.payment === 'cash' ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-red-600 text-white px-3 py-1 rounded font-semibold text-xs">
                            Cash
                          </span>
                          <button
                            className="bg-white border border-red-600 text-red-600 rounded-full p-1 hover:bg-red-100 transition shadow-sm"
                            title="Mark as Collected"
                            onClick={() => handleCashCollectionClick(appt)}
                          >
                            {/* X icon for not collected */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <span className="text-red-600 text-xs">Pending</span>
                        </div>
                      ) : appt.payment === 'cash_collected' ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-green-600 text-white px-3 py-1 rounded font-semibold text-xs">
                            Cash
                          </span>
                          <button
                            className="bg-white border border-green-600 text-green-600 rounded-full p-1 hover:bg-green-100 transition shadow-sm"
                            title="Mark as Not Collected"
                            onClick={() => handleCashCollectionClick(appt)}
                          >
                            {/* Check icon for collected */}
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          </button>
                          <span className="text-green-600 text-xs">✓ Collected</span>
                        </div>
                      ) : appt.payment === 'Payment not recorded' ? (
                        <span className="text-orange-500 text-xs">Payment not recorded</span>
                      ) : appt.payment === 'No visit number' ? (
                        <span className="text-red-500 text-xs">No visit number</span>
                      ) : appt.payment === 'Payment lookup failed' ? (
                        <span className="text-red-500 text-xs">Payment lookup failed</span>
                      ) : (
                        <span className="text-gray-400 text-xs">{appt.payment}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-gray-700">Page {page} of {totalPages || 1}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {/* Closed days modal */}
      <Dialog open={showClosedDaysModal} onClose={() => setShowClosedDaysModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full">
            <Dialog.Title className="text-xl font-bold text-gray-800 mb-4">Manage Closed Days</Dialog.Title>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <label className="w-28">From:</label>
                <input type="date" value={closedFromDate} onChange={e => { setClosedFromDate(e.target.value); if (!closedToDate) setClosedToDate(e.target.value); }} className="border rounded px-3 py-2" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-28">To:</label>
                <input type="date" value={closedToDate} onChange={e => setClosedToDate(e.target.value)} className="border rounded px-3 py-2" />
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-28">Branch:</label>
                <select value={closedBranch} onChange={e => setClosedBranch(e.target.value)} className="border rounded px-3 py-2">
                  <option value="All">All branches</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label className="w-28">Reason:</label>
                <input value={closedReason} onChange={e => setClosedReason(e.target.value)} className="border rounded px-3 py-2 flex-1" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleAddClosedDay} className="bg-green-600 text-white px-4 py-2 rounded font-semibold">Add</button>
                <button onClick={() => setShowClosedDaysModal(false)} className="bg-gray-200 px-4 py-2 rounded">Close</button>
              </div>
              <hr />
              <div>
                <h4 className="font-semibold mb-2">Existing Closed Days</h4>
                {closedDaysList.length === 0 ? (
                  <div className="text-gray-500">No closed days configured.</div>
                ) : (
                  <ul className="space-y-2">
                    {closedDaysList.map(cd => (
                      <li key={cd._id} className="flex items-center justify-between border p-2 rounded">
                        <div>
                          <div className="text-sm font-medium">
                            {cd.dateFrom && cd.dateTo
                              ? `${new Date(cd.dateFrom).toISOString().slice(0,10)} → ${new Date(cd.dateTo).toISOString().slice(0,10)}`
                              : cd.date
                                ? new Date(cd.date).toISOString().slice(0,10)
                                : 'Unknown date'}
                            {' '}— {cd.branch}
                          </div>
                          <div className="text-xs text-gray-600">{cd.reason}</div>
                        </div>
                        <div>
                          <button onClick={() => handleRemoveClosedDay(cd._id)} className="text-red-600">Remove</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      {/* Floating Add Image Button */}
      <button
        onClick={() => router.push('/n_dashboard/add_img')}
        className="fixed bottom-8 right-8 bg-blue-700 text-white rounded-full shadow-lg w-16 h-16 flex items-center justify-center text-3xl hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 z-50"
        title="Add Prescription Image"
      >
        +
      </button>
      {/* Add Report Button */}
      <button
        className="fixed left-6 bottom-6 bg-purple-700 text-white px-6 py-3 rounded-full shadow-lg font-bold text-lg hover:bg-purple-800 z-50"
        onClick={() => router.push("/n_dashboard/add_report")}
        style={{ minWidth: 180 }}
      >
        + Add Report (PDF)
      </button>
    </div>
  );
} 