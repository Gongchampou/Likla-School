import React, { useState } from 'react';
import { authenticate } from '../utils/auth';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await authenticate(email.trim(), password);
      if (!user) {
        setError('Invalid email or password');
      } else {
        onLogin(user as User);
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted dark:bg-dark-background p-4">
      <div className="w-full max-w-md bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-1 text-center">Welcome</h2>
        <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground text-center mb-6">Sign in to continue</p>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-2">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border bg-muted dark:bg-dark-muted border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border bg-muted dark:bg-dark-muted border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md text-white bg-primary hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
