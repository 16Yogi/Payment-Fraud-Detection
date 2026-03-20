/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Plus, 
  History, 
  TrendingUp, 
  AlertTriangle,
  CreditCard,
  MapPin,
  Clock,
  Tag,
  Loader2,
  ChevronRight,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";

interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  location: string;
  timestamp: string;
  prediction?: {
    status: 'safe' | 'suspicious' | 'fraud';
    score: number;
    reasoning: string;
  };
}

const CATEGORIES = ['Retail', 'Food & Drink', 'Travel', 'Entertainment', 'Services', 'Health', 'Other'];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('access_token');
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Auth Form
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Dataset testing
  const [isDatasetRunning, setIsDatasetRunning] = useState(false);
  const [datasetResult, setDatasetResult] = useState<any>(null);
  const [datasetPathInput, setDatasetPathInput] = useState<string>(
    'sample_fraud_payment_data.csv'
  );

  useEffect(() => {
    if (accessToken) localStorage.setItem('access_token', accessToken);
    else localStorage.removeItem('access_token');
  }, [accessToken]);
  
  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    merchant: '',
    category: 'Retail',
    location: '',
  });

  const analyzeTransaction = async (tx: Transaction) => {
    setIsAnalyzing(true);
    try {
      if (!accessToken) throw new Error('You must login before analyzing.');

      const response = await fetch(`${API_BASE_URL}/api/fraud/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: tx.amount,
          currency: 'USD',
          country: tx.location,
          merchant_category: tx.category,
          transaction_time_utc: tx.timestamp,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Fraud scoring failed (${response.status})`);
      }

      const result = await response.json();

      setTransactions(prev => [{ ...tx, prediction: result }, ...prev]);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
      setShowForm(false);
      setFormData({ amount: '', merchant: '', category: 'Retail', location: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount: parseFloat(formData.amount),
      merchant: formData.merchant,
      category: formData.category,
      location: formData.location,
      timestamp: new Date().toISOString(),
    };
    analyzeTransaction(newTx);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const params = new URLSearchParams();
      params.append('username', authUsername);
      params.append('password', authPassword);

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Login failed (${response.status})`);
      }

      const data = await response.json();
      setAccessToken(data.access_token);
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Register failed (${response.status})`);
      }

      setAuthMode('login');
    } catch (err: any) {
      setAuthError(err?.message || 'Register failed');
    }
  };

  const handleLogout = async () => {
    try {
      if (accessToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch {
      // Ignore logout errors; still clear token locally.
    } finally {
      setAccessToken(null);
    }
  };

  const runDatasetTest = async () => {
    setIsDatasetRunning(true);
    setDatasetResult(null);
    try {
      if (!accessToken) throw new Error('You must login first.');

      const response = await fetch(`${API_BASE_URL}/api/dataset/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dataset_path: datasetPathInput,
          fraud_threshold: 60,
          suspicious_threshold: 30,
          risk_predictions_limit_per_group: 15,
          return_fraud_predictions: true,
        }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(text || `Dataset run failed (${response.status})`);
      setDatasetResult(JSON.parse(text));
    } catch (err: any) {
      setDatasetResult({ error: err?.message || 'Dataset run failed' });
    } finally {
      setIsDatasetRunning(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-black/5 shadow-sm p-8">
          <h2 className="text-2xl font-bold mb-2">SENTINEL Login</h2>
          <p className="text-black/40 text-sm mb-6">Login to run fraud scoring and dataset tests.</p>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                authMode === 'login' ? 'bg-black text-white' : 'bg-black/5 text-black'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                authMode === 'register' ? 'bg-black text-white' : 'bg-black/5 text-black'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">
                Username
              </label>
              <input
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="e.g. admin"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">
                Password
              </label>
              <input
                required
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Enter password"
              />
            </div>

            {authError && <div className="text-sm text-red-600 font-medium">{authError}</div>}

            <button
              type="submit"
              className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-black/90 transition-all"
            >
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="border-b border-black/5 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <ShieldAlert className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SENTINEL</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-black/5 rounded-full text-xs font-medium text-black/60">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM ACTIVE
            </div>
            <button 
              onClick={() => setShowForm(true)}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/80 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Transaction
            </button>

            <button
              onClick={runDatasetTest}
              disabled={isDatasetRunning}
              className="bg-white text-black px-4 py-2 rounded-xl text-sm font-medium border border-black/5 hover:bg-black/5 transition-colors"
            >
              {isDatasetRunning ? 'Running...' : 'Run Dataset Test'}
            </button>

            <input
              value={datasetPathInput}
              onChange={(e) => setDatasetPathInput(e.target.value)}
              className="w-64 bg-black/5 text-black px-4 py-2 rounded-xl text-sm font-medium border border-black/5 focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Dataset path (e.g. sample_fraud_payment_data.csv)"
              title="Relative to backend/dataset/"
            />

            <button
              onClick={handleLogout}
              className="bg-black/5 text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-black/40 uppercase tracking-wider">Total Scanned</span>
            </div>
            <div className="text-3xl font-bold">{transactions.length}</div>
            <div className="text-xs text-black/40 mt-1">Real-time monitoring active</div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-black/40 uppercase tracking-wider">Flagged</span>
            </div>
            <div className="text-3xl font-bold">
              {transactions.filter(t => t.prediction?.status !== 'safe').length}
            </div>
            <div className="text-xs text-black/40 mt-1">Requiring manual review</div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-black/40 uppercase tracking-wider">Accuracy</span>
            </div>
            <div className="text-3xl font-bold">
              {datasetResult?.accuracy != null ? `${(datasetResult.accuracy * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-black/40 mt-1">
              {datasetResult ? `Precision ${Math.round((datasetResult.precision || 0) * 100)}% • Recall ${Math.round((datasetResult.recall || 0) * 100)}%` : 'Run dataset test to see metrics'}
            </div>
          </div>
        </div>

        {datasetResult && !datasetResult.error && (
          <div className="mb-8 bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Dataset Test Summary</h3>
              <span className="text-xs font-medium text-black/40">
                {datasetResult.dataset_name}
              </span>
            </div>
            <div className="text-sm text-black/60">
              Total: {datasetResult.total_rows} • Fraud rows: {datasetResult.fraud_rows} • TP: {datasetResult.tp} • FP: {datasetResult.fp} • TN: {datasetResult.tn} • FN: {datasetResult.fn}
            </div>
          </div>
        )}

        {(datasetResult?.low_risk_predictions?.length > 0 ||
          datasetResult?.medium_risk_predictions?.length > 0 ||
          datasetResult?.high_risk_predictions?.length > 0) && (
          <div className="mb-8 bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Risk Categorized Fraud Payments</h3>
              <span className="text-xs font-medium text-black/40">
                Scroll inside each risk group
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Low Risk */}
              <div className="rounded-xl border border-black/5 p-4 bg-black/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="font-semibold">Low Risk</h4>
                  </div>
                  <span className="text-xs text-black/40">{datasetResult.low_risk_predictions.length}</span>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {datasetResult.low_risk_predictions.map((it: any, idx: number) => (
                    <div key={`${it.dataset_transaction_id ?? 'row'}-${idx}`} className="p-3 rounded-lg border border-black/5 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest opacity-60">
                            {it.status} • Risk Score: {Math.round(it.score)}%
                          </div>
                          <div className="font-semibold text-sm mt-1">
                            {it.merchant_category ?? 'Category'} • {it.payment_method ?? 'Payment Method'}
                          </div>
                          <div className="text-xs text-black/50 mt-1">
                            Amount: ${Number(it.amount ?? 0).toFixed(2)}
                            {it.country ? ` • ${it.country}` : ''}
                            {it.device_type ? ` • ${it.device_type}` : ''}
                          </div>
                          {it.reasoning ? <p className="text-xs text-black/70 mt-2 leading-relaxed">{it.reasoning}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {datasetResult.low_risk_predictions.length === 0 && (
                    <div className="text-xs text-black/40">No low-risk items</div>
                  )}
                </div>
              </div>

              {/* Medium Risk */}
              <div className="rounded-xl border border-black/5 p-4 bg-black/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <h4 className="font-semibold">Medium Risk</h4>
                  </div>
                  <span className="text-xs text-black/40">{datasetResult.medium_risk_predictions.length}</span>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {datasetResult.medium_risk_predictions.map((it: any, idx: number) => (
                    <div key={`${it.dataset_transaction_id ?? 'row'}-${idx}`} className="p-3 rounded-lg border border-black/5 bg-white">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-60">
                          {it.status} • Risk Score: {Math.round(it.score)}%
                        </div>
                        <div className="font-semibold text-sm mt-1">
                          {it.merchant_category ?? 'Category'} • {it.payment_method ?? 'Payment Method'}
                        </div>
                        <div className="text-xs text-black/50 mt-1">
                          Amount: ${Number(it.amount ?? 0).toFixed(2)}
                          {it.country ? ` • ${it.country}` : ''}
                          {it.device_type ? ` • ${it.device_type}` : ''}
                        </div>
                        {it.reasoning ? <p className="text-xs text-black/70 mt-2 leading-relaxed">{it.reasoning}</p> : null}
                      </div>
                    </div>
                  ))}
                  {datasetResult.medium_risk_predictions.length === 0 && (
                    <div className="text-xs text-black/40">No medium-risk items</div>
                  )}
                </div>
              </div>

              {/* High Risk */}
              <div className="rounded-xl border border-black/5 p-4 bg-black/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <h4 className="font-semibold">High Risk</h4>
                  </div>
                  <span className="text-xs text-black/40">{datasetResult.high_risk_predictions.length}</span>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                  {datasetResult.high_risk_predictions.map((it: any, idx: number) => (
                    <div key={`${it.dataset_transaction_id ?? 'row'}-${idx}`} className="p-3 rounded-lg border border-black/5 bg-white">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest opacity-60">
                          {it.status} • Risk Score: {Math.round(it.score)}%
                        </div>
                        <div className="font-semibold text-sm mt-1">
                          {it.merchant_category ?? 'Category'} • {it.payment_method ?? 'Payment Method'}
                        </div>
                        <div className="text-xs text-black/50 mt-1">
                          Amount: ${Number(it.amount ?? 0).toFixed(2)}
                          {it.country ? ` • ${it.country}` : ''}
                          {it.device_type ? ` • ${it.device_type}` : ''}
                        </div>
                        {it.reasoning ? <p className="text-xs text-black/70 mt-2 leading-relaxed">{it.reasoning}</p> : null}
                      </div>
                    </div>
                  ))}
                  {datasetResult.high_risk_predictions.length === 0 && (
                    <div className="text-xs text-black/40">No high-risk items</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Transaction List */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
                <h2 className="font-semibold">Recent Activity</h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                  <input 
                    type="text" 
                    placeholder="Search merchant..." 
                    className="pl-9 pr-4 py-1.5 bg-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/5 w-48"
                  />
                </div>
              </div>
              
              <div className="divide-y divide-black/5">
                {transactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ArrowRightLeft className="w-8 h-8 text-black/20" />
                    </div>
                    <p className="text-black/40 font-medium">No transactions analyzed yet.</p>
                    <button 
                      onClick={() => setShowForm(true)}
                      className="mt-4 text-sm font-semibold text-black hover:underline"
                    >
                      Analyze your first transaction
                    </button>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={tx.id} 
                      className="p-6 hover:bg-black/[0.01] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.prediction?.status === 'safe' ? 'bg-emerald-50 text-emerald-600' :
                            tx.prediction?.status === 'suspicious' ? 'bg-amber-50 text-amber-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {tx.prediction?.status === 'safe' ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">{tx.merchant}</h3>
                              <span className="px-2 py-0.5 bg-black/5 rounded text-[10px] font-bold uppercase tracking-wider text-black/40">
                                {tx.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-black/40">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {tx.location}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(tx.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {tx.prediction && (
                              <div className="mt-3 p-3 bg-black/[0.02] rounded-xl border border-black/5">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    tx.prediction.status === 'safe' ? 'bg-emerald-500' :
                                    tx.prediction.status === 'suspicious' ? 'bg-amber-500' :
                                    'bg-red-500'
                                  }`} />
                                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                                    {tx.prediction.status} • Risk Score: {tx.prediction.score}%
                                  </span>
                                </div>
                                <p className="text-sm text-black/70 leading-relaxed">
                                  {tx.prediction.reasoning}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">${tx.amount.toFixed(2)}</div>
                          <button className="mt-2 text-black/20 group-hover:text-black transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar / Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-black text-white p-8 rounded-3xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4 leading-tight">Secure your financial ecosystem.</h3>
                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                  Our neural engine analyzes thousands of data points to detect anomalies before they become problems.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Real-time Analysis</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <Tag className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Auto-Categorization</span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Risk Distribution
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Low Risk', value: 85, color: 'bg-emerald-500' },
                  { label: 'Medium Risk', value: 12, color: 'bg-amber-500' },
                  { label: 'High Risk', value: 3, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isAnalyzing && setShowForm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-2">Analyze Transaction</h2>
                <p className="text-black/40 text-sm mb-8">Enter the details below for instant AI verification.</p>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Merchant Name</label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Apple Store"
                        value={formData.merchant}
                        onChange={e => setFormData({...formData, merchant: e.target.value})}
                        className="w-full pl-11 pr-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Amount ($)</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})}
                        className="w-full px-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Category</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full px-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 transition-all appearance-none"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Location</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-black/30" />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. San Francisco, CA"
                        value={formData.location}
                        onChange={e => setFormData({...formData, location: e.target.value})}
                        className="w-full pl-11 pr-4 py-3 bg-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    disabled={isAnalyzing}
                    type="submit"
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing with Gemini...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" />
                        Run Security Check
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
