import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  addSubAdmin,
  deleteSubAdmin,
  getSession,
  getUsers,
  loginAdmin,
  logoutAdmin,
  MAX_SUB_ADMINS,
  replaceSubAdmin,
} from '../utils/adminAuth';
import type { AdminSession, AdminUser } from '../utils/adminAuth';

interface Props {
  onBack: () => void;
  onOpenSettings: () => void;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

function isMainAdmin(session: AdminSession | null) {
  return Boolean(
    session &&
      session.role === 'administrator' &&
      session.isSuperAdmin === true &&
      session.username === 'admin'
  );
}

export const SettingsAccessView: React.FC<Props> = ({
  onBack,
  onOpenSettings,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [session, setSession] = useState<AdminSession | null>(null);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [replaceOldEmail, setReplaceOldEmail] = useState('');
  const [replaceNewEmail, setReplaceNewEmail] = useState('');
  const [replaceNewPassword, setReplaceNewPassword] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mainAdmin = isMainAdmin(session);

  const subAdmins = useMemo(
    () => users.filter((user) => user.role === 'sub_admin'),
    [users]
  );

  const reload = () => {
    setUsers(getUsers());
    setSession(getSession());
  };

  useEffect(() => {
    reload();
  }, []);

  const resetMessages = () => {
    setMessage(null);
    setError(null);
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    try {
      const loggedInSession = await loginAdmin(
        loginUsername,
        loginPassword
      );

      setSession(loggedInSession);
      setLoginUsername('');
      setLoginPassword('');
      setUsers(getUsers());
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setSession(null);
    setMessage('Logged out.');
    setError(null);
  };

  const handleAddSubAdmin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    resetMessages();

    if (!mainAdmin) {
      setError('Only the main admin user can add sub-admin users.');
      return;
    }

    try {
      await addSubAdmin(newEmail, newPassword);

      setMessage('Sub-admin user added successfully.');
      setNewEmail('');
      setNewPassword('');
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeleteSubAdmin = (email: string) => {
    resetMessages();

    if (!mainAdmin) {
      setError('Only the main admin user can delete sub-admin users.');
      return;
    }

    const confirmed = window.confirm(
      `Delete sub-admin user ${email}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      deleteSubAdmin(email);
      setMessage(`Sub-admin user ${email} deleted successfully.`);
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleReplaceSubAdmin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    resetMessages();

    if (!mainAdmin) {
      setError('Only the main admin user can replace sub-admin users.');
      return;
    }

    try {
      await replaceSubAdmin(
        replaceOldEmail,
        replaceNewEmail,
        replaceNewPassword
      );

      setMessage('Sub-admin user replaced successfully.');
      setReplaceOldEmail('');
      setReplaceNewEmail('');
      setReplaceNewPassword('');
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-lab-subtext hover:text-lab-primary mb-6 transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Fleet
      </button>

      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-lab-primary" size={32} />

        <div>
          <h1 className="text-3xl font-bold text-lab-text">
            Settings Access Control
          </h1>

          <p className="text-lab-subtext">
            Login is required before changing printer IP addresses or access
            codes.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!session && (
        <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="text-lab-primary" />

            <h2 className="text-xl font-bold text-lab-text">
              Login to Settings
            </h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
              className="w-full border border-lab-accent rounded-lg px-4 py-3"
              autoComplete="username"
            />

            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              className="w-full border border-lab-accent rounded-lg px-4 py-3"
              autoComplete="current-password"
            />

            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-lab-primary text-white font-semibold hover:opacity-90"
            >
              Login
            </button>
          </form>
        </div>
      )}

      {session?.role === 'sub_admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6 max-w-xl">
          <h2 className="text-xl font-bold text-lab-text mb-2">
            Sub-admin Access
          </h2>

          <p className="text-sm text-lab-subtext mb-4">
            Logged in as {session.username}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-lab-primary text-white font-semibold hover:opacity-90"
            >
              <Settings size={18} />
              Open Printer Settings
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-3 rounded-lg border border-lab-accent bg-white text-lab-text font-semibold hover:bg-lab-bg"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      )}

      {session?.role === 'administrator' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-lab-text">
                Administrator Panel
              </h2>

              <p className="text-sm text-lab-subtext">
                Logged in as {session.username}
                {session.isSuperAdmin ? ' · Super admin' : ''}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-lab-primary text-white font-semibold hover:opacity-90"
              >
                <Settings size={18} />
                Open Printer Settings
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border border-lab-accent bg-white text-lab-text font-semibold hover:bg-lab-bg"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6">
            <h2 className="text-xl font-bold text-lab-text mb-2">
              Sub-admin users
            </h2>

            <p className="text-sm text-lab-subtext mb-4">
              {subAdmins.length} of {MAX_SUB_ADMINS} sub-admin users are used.
            </p>

            {subAdmins.length === 0 ? (
              <p className="text-sm text-lab-subtext">
                No sub-admin users have been added yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-lab-accent">
                <table className="w-full text-left">
                  <thead className="bg-lab-bg">
                    <tr>
                      <th className="p-3 text-sm font-bold text-lab-subtext">
                        Email
                      </th>
                      <th className="p-3 text-sm font-bold text-lab-subtext">
                        Role
                      </th>
                      <th className="p-3 text-sm font-bold text-lab-subtext">
                        Updated
                      </th>
                      <th className="p-3 text-right text-sm font-bold text-lab-subtext">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {subAdmins.map((user) => (
                      <tr key={user.email}>
                        <td className="p-3 text-sm text-lab-text">
                          {user.email}
                        </td>

                        <td className="p-3 text-sm text-lab-text">
                          {user.role}
                        </td>

                        <td className="p-3 text-sm text-lab-subtext">
                          {new Date(user.updatedAt).toLocaleString()}
                        </td>

                        <td className="p-3 text-right">
                          {mainAdmin ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteSubAdmin(user.email)
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 hover:text-red-800"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          ) : (
                            <span className="text-sm text-lab-subtext">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {mainAdmin && subAdmins.length < MAX_SUB_ADMINS && (
            <div className="bg-white rounded-xl shadow-sm border border-lab-accent p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="text-lab-primary" />

                <h2 className="text-xl font-bold text-lab-text">
                  Add sub-admin
                </h2>
              </div>

              <form onSubmit={handleAddSubAdmin} className="space-y-4">
                <input
                  type="email"
                  placeholder="firstname.lastname@tuni.fi"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="w-full border border-lab-accent rounded-lg px-4 py-3"
                  autoComplete="off"
                />

                <input
                  type="password"
                  placeholder="Password, 5 to 8 characters"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full border border-lab-accent rounded-lg px-4 py-3"
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  className="px-5 py-3 rounded-lg bg-lab-primary text-white font-semibold hover:opacity-90"
                >
                  Add Sub-admin
                </button>
              </form>
            </div>
          )}

          {mainAdmin && subAdmins.length >= MAX_SUB_ADMINS && (
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="text-yellow-600" />

                <h2 className="text-xl font-bold text-lab-text">
                  Replace existing sub-admin
                </h2>
              </div>

              <p className="text-sm text-lab-subtext mb-4">
                Maximum 3 sub-admins already exist. To add a new one, select
                which existing user should be replaced, or delete one from the
                table above.
              </p>

              <form onSubmit={handleReplaceSubAdmin} className="space-y-4">
                <select
                  value={replaceOldEmail}
                  onChange={(event) => setReplaceOldEmail(event.target.value)}
                  className="w-full border border-lab-accent rounded-lg px-4 py-3"
                >
                  <option value="">Select user to replace</option>

                  {subAdmins.map((user) => (
                    <option key={user.email} value={user.email}>
                      {user.email}
                    </option>
                  ))}
                </select>

                <input
                  type="email"
                  placeholder="firstname.lastname@tuni.fi"
                  value={replaceNewEmail}
                  onChange={(event) => setReplaceNewEmail(event.target.value)}
                  className="w-full border border-lab-accent rounded-lg px-4 py-3"
                  autoComplete="off"
                />

                <input
                  type="password"
                  placeholder="New password, 5 to 8 characters"
                  value={replaceNewPassword}
                  onChange={(event) =>
                    setReplaceNewPassword(event.target.value)
                  }
                  className="w-full border border-lab-accent rounded-lg px-4 py-3"
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  className="px-5 py-3 rounded-lg bg-yellow-500 text-white font-semibold hover:opacity-90"
                >
                  Replace Sub-admin
                </button>
              </form>
            </div>
          )}

          {!mainAdmin && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              You can open printer settings, but only the main admin account
              can add, delete, or replace sub-admin users.
            </div>
          )}
        </div>
      )}
    </div>
  );
};