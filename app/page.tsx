"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';

const TOKEN_KEY = 'doctor_jwt';
const TOKEN_EXPIRY_KEY = 'doctor_token_expiry';

const setAuthToken = (token: string) => {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24); // 24 hours from now
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
};

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

export default function LoginPage() {
  const [loginType, setLoginType] = useState('Doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOld, setForgotOld] = useState('');
  const [forgotNew, setForgotNew] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLocked, setForgotLocked] = useState(false);
  const [forgotLockedUntil, setForgotLockedUntil] = useState<Date|null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setIsAuthenticated(true);
      setTimeout(() => {
        router.replace('/dashboard');
      }, 1000);
    } else {
      setIsAuthenticated(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/doctor/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: loginType }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        setIsAuthenticated(true);
        if (loginType === 'Nurse') {
          router.replace('/n_dashboard');
        } else {
          router.replace('/dashboard');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-white bg-opacity-80 rounded-2xl shadow-xl p-8 flex flex-col gap-6"
        style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="loginType" className="text-base font-medium text-gray-700">Login Type</label>
          <select
            id="loginType"
            value={loginType}
            onChange={e => setLoginType(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-3 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="Doctor">Doctor</option>
            <option value="Nurse">Nurse</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-base font-medium text-gray-700">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter User Email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-base font-medium text-gray-700">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Password"
            required
          />
          {/* Forgot Password Button for Nurse */}
          {loginType === 'Nurse' && (
            <button
              type="button"
              className="text-blue-600 text-sm mt-1 hover:underline disabled:opacity-50"
              onClick={() => {
                setShowForgot(true);
                setForgotEmail(email);
                setForgotOld('');
                setForgotNew('');
                setForgotError('');
                setForgotSuccess('');
              }}
              disabled={forgotLocked}
              title={forgotLocked && forgotLockedUntil ? `Locked until ${forgotLockedUntil.toLocaleString()}` : ''}
            >
              Forgot Password?
            </button>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Forgot Password Modal */}
      <Dialog open={showForgot} onClose={() => setShowForgot(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          {/* Overlay replacement for Dialog.Overlay */}
          <div className="fixed inset-0 bg-black opacity-30" aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl p-8 w-full max-w-md mx-auto z-10">
            <Dialog.Title className="text-lg font-bold mb-4">Reset Nurse Password</Dialog.Title>
            {forgotSuccess ? (
              <div className="text-green-600 mb-4">{forgotSuccess}</div>
            ) : (
              <>
                <label className="block mb-2 font-medium">Nurse Email</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2 mb-4"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  disabled={forgotLoading || forgotLocked}
                  placeholder="Enter nurse email"
                />
                <label className="block mb-2 font-medium">Current Password</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2 mb-4"
                  value={forgotOld}
                  onChange={e => setForgotOld(e.target.value)}
                  disabled={forgotLoading || forgotLocked}
                  placeholder="Current password"
                />
                <label className="block mb-2 font-medium">New Password</label>
                <input
                  type="password"
                  className="w-full border rounded px-3 py-2 mb-4"
                  value={forgotNew}
                  onChange={e => setForgotNew(e.target.value)}
                  disabled={forgotLoading || forgotLocked}
                  placeholder="New password"
                />
                {forgotError && <div className="text-red-600 mb-2">{forgotError}</div>}
                <button
                  className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
                  onClick={async () => {
                    setForgotLoading(true);
                    setForgotError('');
                    setForgotSuccess('');
                    try {
                      const res = await fetch('/api/nurse/change_password', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ oldPassword: forgotOld, newPassword: forgotNew, email: forgotEmail }),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setForgotSuccess('Password changed successfully!');
                        setForgotOld('');
                        setForgotNew('');
                        setForgotError('');
                        setForgotLocked(false);
                        setForgotLockedUntil(null);
                      } else if (data.lockedUntil) {
                        setForgotError(data.error || 'Locked out');
                        setForgotLocked(true);
                        setForgotLockedUntil(new Date(data.lockedUntil));
                      } else {
                        setForgotError(data.error || 'Failed to change password');
                      }
                    } catch (err) {
                      setForgotError('Server error');
                    }
                    setForgotLoading(false);
                  }}
                  disabled={forgotLoading || forgotLocked || !forgotEmail || !forgotOld || !forgotNew}
                >
                  Change Password
                </button>
              </>
            )}
            <button
              className="mt-4 w-full bg-gray-200 text-gray-700 py-2 rounded font-semibold hover:bg-gray-300"
              onClick={() => setShowForgot(false)}
              disabled={forgotLoading}
            >
              Close
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
