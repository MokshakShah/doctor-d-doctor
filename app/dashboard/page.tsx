"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = 'doctor_jwt';
const TOKEN_EXPIRY_KEY = 'doctor_token_expiry';

const getAuthToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return null;
  const expiryDate = new Date(expiry);
  const now = new Date();
  if (now > expiryDate) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return token;
};

const branches = ["Bhayander", "Borivali", "Malad"];

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activePatients, setActivePatients] = useState<{ total: number; perBranch: Record<string, number> } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchDropdown, setSearchDropdown] = useState(false);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/");
      return;
    }
    fetchActivePatients();
  }, [router]);

  const fetchActivePatients = async (branch?: string) => {
    setLoading(true);
    let url = "/api/doctor/activePatients";
    if (branch) url += `?branch=${encodeURIComponent(branch)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (branch) {
      setActivePatients({ total: data.count, perBranch: { [branch]: data.count } });
    } else {
      setActivePatients(data);
    }
    setLoading(false);
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branch = e.target.value;
    setSelectedBranch(branch);
    if (branch) {
      fetchActivePatients(branch);
    } else {
      fetchActivePatients();
    }
  };

  // Bar chart rendering
  const renderBarChart = () => {
    if (!activePatients || !activePatients.perBranch) return null;
    const data = Object.entries(activePatients.perBranch);
    const max = Math.max(...data.map(([, count]) => count), 1);
    const barWidth = 60;
    const barGap = 30;
    const chartHeight = 180;
    return (
      <svg width={data.length * (barWidth + barGap)} height={chartHeight + 40} className="mx-auto block">
        {data.map(([branch, count], i) => {
          const barHeight = (count / max) * chartHeight;
          return (
            <g key={branch}>
              <rect
                x={i * (barWidth + barGap)}
                y={chartHeight - barHeight + 20}
                width={barWidth}
                height={barHeight}
                rx={12}
                fill="url(#barGradient)"
              />
              <text
                x={i * (barWidth + barGap) + barWidth / 2}
                y={chartHeight + 35}
                textAnchor="middle"
                className="fill-gray-700 text-sm font-semibold"
              >
                {branch}
              </text>
              <text
                x={i * (barWidth + barGap) + barWidth / 2}
                y={chartHeight - barHeight + 10}
                textAnchor="middle"
                className="fill-blue-700 text-base font-bold"
              >
                {count}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  // Debounced search
  useEffect(() => {
    if (!search) {
      setSearchResults([]);
      setSearchDropdown(false);
      setSelectedPatientName(null);
      return;
    }
    setSearchLoading(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/doctor/searchPatient?name=${encodeURIComponent(search)}`);
      const data = await res.json();
      setSearchResults(data.patients || []);
      setSearchDropdown(true);
      setSearchLoading(false);
    }, 350);
  }, [search]);

  // Dropdown select
  const handleSelectPatientName = (name: string) => {
    setSearchDropdown(false);
    router.push(`/patient?name=${encodeURIComponent(name)}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('doctor_jwt');
    localStorage.removeItem('doctor_token_expiry');
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl mt-8 relative">
        <button
          onClick={handleLogout}
          className="absolute right-0 top-0 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
        >
          Log Out
        </button>
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-start">Doctor Dashboard</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="branch" className="text-gray-700 font-medium">Branch:</label>
            <select
              id="branch"
              value={selectedBranch}
              onChange={handleBranchChange}
              className="border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search patient by name..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setSelectedPatientName(null);
              }}
              className="border border-gray-300 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() => searchResults.length > 0 && setSearchDropdown(true)}
              autoComplete="off"
            />
            {searchDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                {searchResults.map((p, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-gray-800"
                    onClick={() => handleSelectPatientName(p.name)}
                  >
                    {p.name} <span className="text-xs text-blue-600 ml-2">{p.locations.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
            {searchLoading && (
              <div className="absolute right-3 top-3 w-4 h-4 border-b-2 border-blue-400 rounded-full animate-spin"></div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : activePatients ? (
            <div className="space-y-2">
              <div className="text-lg font-semibold text-gray-700 mb-4">
                {selectedBranch
                  ? `Active Patients in ${selectedBranch}: ${activePatients.total}`
                  : `Total Active Patients: ${activePatients.total}`}
              </div>
              {renderBarChart()}
            </div>
          ) : (
            <div className="text-gray-500">No data available.</div>
          )}
        </div>
      </div>
    </div>
  );
} 