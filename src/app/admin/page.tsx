"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { loginAdmin, getVaccinationCenters, addVaccinationCenter, deleteVaccinationCenter, type VaccinationCenter } from '@/app/actions/admin';
import {
  ShieldCheck, XCircle, CheckCircle, Radio, MapPin, Activity,
  AlertTriangle, RefreshCw, Lock, Key, Trash2, LogOut, Loader2
} from "lucide-react";

// Dynamically import Map (Reuse the component we made)
const OutbreakMap = dynamic(() => import('@/components/OutbreakMap'), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-500">Loading Map...</div>
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Alert = {
  id: string;
  title: string;
  location: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  status: 'verified' | 'pending';
  created_at: string;
  lat?: number;
  lng?: number;
};

export default function AdminDashboard() {
  const router = useRouter();

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  // Data State
  const [pendingAlerts, setPendingAlerts] = useState<Alert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast Form
  const [formData, setFormData] = useState({
    title: "",
    severity: "Medium",
    location: "",
    description: "",
    lat: 28.4744, // Default Lat
    lng: 77.5040  // Default Lng
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- VACCINATION CENTERS STATE ---
  const [activeTab, setActiveTab] = useState<'alerts' | 'centers'>('alerts');
  const [centers, setCenters] = useState<VaccinationCenter[]>([]);
  const [centerForm, setCenterForm] = useState({ name: "", state: "", city: "", address: "" });
  const [isCenterSubmitting, setIsCenterSubmitting] = useState(false);
  const [centerFilter, setCenterFilter] = useState({ name: "", city: "", state: "" });

  // --- LOGIN LOGIC ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const result = await loginAdmin(loginForm.username, loginForm.password);
      if (result.success) {
        setIsAuthenticated(true);
        loadData();
      } else {
        setAuthError("Invalid credentials");
      }
    } catch (err) {
      setAuthError("Login failed");
    } finally {
      setAuthLoading(false);
    }
  }

  // --- DATA FETCHING ---
  async function loadData() {
    setLoading(true);

    // Fetch Pending
    const { data: pending } = await supabase
      .from('alerts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Fetch Active
    const { data: active } = await supabase
      .from('alerts')
      .select('*')
      .eq('status', 'verified')
      .order('created_at', { ascending: false });

    setPendingAlerts((pending as Alert[]) || []);
    setActiveAlerts((active as Alert[]) || []);
    
    // Fetch Centers
    const centersResult = await getVaccinationCenters();
    if (centersResult.success) {
      setCenters(centersResult.centers);
    }

    setLoading(false);
  }

  // --- CENTER ACTIONS ---
  async function handleAddCenter(e: React.FormEvent) {
    e.preventDefault();
    setIsCenterSubmitting(true);
    const res = await addVaccinationCenter(centerForm);
    if (res.success) {
        alert("Vaccination Center Added");
        setCenterForm({ name: "", state: "", city: "", address: "" });
        loadData();
    } else {
        alert("Error: " + res.error);
    }
    setIsCenterSubmitting(false);
  }

  async function handleDeleteCenter(id: string) {
    if(!confirm("Are you sure you want to delete this center?")) return;
    const res = await deleteVaccinationCenter(id);
    if (res.success) {
        setCenters(prev => prev.filter(c => c.id !== id));
    } else {
        alert("Error deleting: " + res.error);
    }
  }
  
  // Filtered Centers
  const filteredCenters = centers.filter(c => {
    const matchName = c.name.toLowerCase().includes(centerFilter.name.toLowerCase());
    const matchCity = c.city.toLowerCase().includes(centerFilter.city.toLowerCase());
    const matchState = c.state.toLowerCase().includes(centerFilter.state.toLowerCase());
    return matchName && matchCity && matchState;
  });

  // --- HANDLE MAP CLICK (For Broadcast) ---
  const handleMapPick = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      lat,
      lng,
      location: `${lat.toFixed(4)}, ${lng.toFixed(4)}` // Auto-fill text location
    }));
  };

  // --- BROADCAST ---
  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.from('alerts').insert([{
      title: formData.title,
      severity: formData.severity,
      location: formData.location,
      description: formData.description,
      status: 'verified',
      cases: 1,
      lat: formData.lat,
      lng: formData.lng
    }]);

    if (!error) {
      alert("Official Alert Broadcasted");
      setFormData({
        title: "", severity: "Medium", description: "", location: "",
        lat: 28.4744, lng: 77.5040
      });
      loadData();
    } else {
      alert("Error: " + error.message);
    }
    setIsSubmitting(false);
  }

  // --- APPROVE / REJECT ---
  async function handleVerify(id: string, decision: "verified" | "rejected") {
    setPendingAlerts(prev => prev.filter(a => a.id !== id));

    if (decision === 'rejected') {
      await supabase.from('alerts').delete().eq('id', id);
    } else {
      await supabase.from('alerts').update({ status: 'verified' }).eq('id', id);
      loadData();
    }
  }

  // --- DELETE ACTIVE ---
  async function handleDelete(id: string) {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
    await supabase.from('alerts').delete().eq('id', id);
  }

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
            <p className="text-slate-500 text-sm">Restricted Access only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium text-slate-800"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-medium text-slate-800"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <XCircle size={16} /> {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {authLoading && <RefreshCw size={18} className="animate-spin" />}
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- DASHBOARD UI ---
  return (
    <div className="min-h-screen bg-gray-50 overflow-auto w-full p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 pb-24">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-xl text-white">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-slate-500">Alert Verification & Broadcast Center</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={loadData} className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all text-slate-500 hover:text-slate-700 shadow-sm">
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-all font-bold shadow-sm text-sm"
            >
              <LogOut size={16} />
              Exit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Left Col: Management */}
          <div className="xl:col-span-2 space-y-6">

            {/* TAB SWITCHER */}
            <div className="flex p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
                <button 
                    onClick={() => setActiveTab('alerts')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'alerts' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    Alerts Management
                </button>
                <button 
                    onClick={() => setActiveTab('centers')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'centers' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    Vaccination Centers
                </button>
            </div>

            {/* --- ALERTS CONTENT --- */}
            {activeTab === 'alerts' && (
            <>
            {/* SECTION 1: PENDING */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Activity size={20} className="text-orange-500" />
                  Pending Verification
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-extrabold">{pendingAlerts.length}</span>
                </h2>
              </div>

              {pendingAlerts.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle size={40} className="mx-auto mb-3 text-slate-200" />
                  <p>No reports pending review.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingAlerts.map(alert => (
                    <div key={alert.id} className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center hover:bg-slate-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={alert.severity} />
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <MapPin size={12} /> {alert.location || 'Unknown Location'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 truncate">{alert.title}</h3>
                        <p className="text-sm text-slate-500 truncate">{alert.description}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleVerify(alert.id, "rejected")}
                          className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition-all">
                          <XCircle size={14} /> Reject
                        </button>
                        <button onClick={() => handleVerify(alert.id, "verified")}
                          className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20 text-xs font-bold flex items-center gap-1 transition-all">
                          <CheckCircle size={14} /> Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 2: ACTIVE */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Radio size={20} className="text-red-500 animate-pulse" />
                  Active Outbreaks
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-extrabold">{activeAlerts.length}</span>
                </h2>
              </div>

              {activeAlerts.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p>No active outbreaks currently being tracked.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                    <tr>
                      <th className="p-4 border-b">Status</th>
                      <th className="p-4 border-b">Title</th>
                      <th className="p-4 border-b">Location</th>
                      <th className="p-4 border-b text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {activeAlerts.map(alert => (
                      <tr key={alert.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">
                          {alert.title}
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {alert.location || "Unknown"}
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDelete(alert.id)} className="text-slate-300 hover:text-red-600 transition-colors p-2" title="Delete Alert">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            </>
            )}

            {/* --- CENTERS CONTENT --- */}
            {activeTab === 'centers' && (
             <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                        <MapPin size={20} className="text-orange-500" />
                        Vaccination Centers
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-extrabold">{filteredCenters.length}</span>
                    </h2>
                </div>
                
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 bg-white/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input type="text" placeholder="Filter Name" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all" 
                         value={centerFilter.name} onChange={e => setCenterFilter({...centerFilter, name: e.target.value})} />
                        <input type="text" placeholder="Filter City" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all" 
                         value={centerFilter.city} onChange={e => setCenterFilter({...centerFilter, city: e.target.value})} />
                         <input type="text" placeholder="Filter State" className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all" 
                         value={centerFilter.state} onChange={e => setCenterFilter({...centerFilter, state: e.target.value})} />
                    </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
                    {filteredCenters.map(center => (
                        <div key={center.id} className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center hover:bg-slate-50 transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700">
                                        Verified Center
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                        <MapPin size={12} /> {center.city}, {center.state}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 truncate text-base">{center.name}</h3>
                                <p className="text-sm text-slate-500 truncate mt-0.5">{center.address || "No specific address provided"}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => handleDeleteCenter(center.id)} 
                                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-2 transition-all">
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                     {filteredCenters.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                            <MapPin size={40} className="mx-auto mb-3 text-slate-200" />
                            <p>No vaccination centers found matching your filters.</p>
                        </div>
                    )}
                </div>
            </section>
            )}

          </div>

          {/* Right Col: Forms & Map */}
          <div className="space-y-6">
            {/* Broadcast Form (Only show on Alerts Tab) */}
            {activeTab === 'alerts' && (
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <Radio size={20} className="text-red-400 animate-pulse" />
                Broadcast Alert
              </h2>

              <div className="h-48 rounded-xl overflow-hidden mb-4 border border-white/20 relative z-0">
                {/* Map Component for Admin Picker */}
                <OutbreakMap
                  alerts={[]}
                  onMapClick={handleMapPick}
                  focusedLocation={null}
                />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white pointer-events-none z-[400]">
                  Click map to set location
                </div>
              </div>

              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                  <input type="text" required placeholder="Alert Title" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all font-medium text-sm"
                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location Name</label>
                  <input type="text" required placeholder="City / Area" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:bg-white/20"
                    value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Coords: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Severity
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Low', 'Medium', 'High'].map(sev => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setFormData({ ...formData, severity: sev })}
                        className={`p-2 rounded-lg text-xs font-bold capitalize transition-all border ${formData.severity === sev
                            ? "bg-white text-slate-900 border-white"
                            : "bg-transparent text-white/50 border-white/20 hover:bg-white/10"
                          }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                  <textarea rows={2} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all text-sm"
                    placeholder="Official guidance..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-red-900/20 transition-all">
                  {isSubmitting ? <RefreshCw size={20} className="animate-spin" /> : <AlertTriangle size={20} />}
                  Broadcast Now
                </button>
              </form>
            </div>
            )}

            {/* Add Center Form (Only show on Centers Tab) */}
            {activeTab === 'centers' && (
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
                        <MapPin size={20} className="text-red-400" />
                        Add New Center
                    </h2>
                    <form onSubmit={handleAddCenter} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Center Name</label>
                            <input type="text" required placeholder="e.g. City Hospital" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all text-sm"
                            value={centerForm.name} onChange={e => setCenterForm({...centerForm, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">State</label>
                                <input type="text" required placeholder="State" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all text-sm"
                                value={centerForm.state} onChange={e => setCenterForm({...centerForm, state: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">City</label>
                                <input type="text" required placeholder="City" className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all text-sm"
                                value={centerForm.city} onChange={e => setCenterForm({...centerForm, city: e.target.value})} />
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Address</label>
                            <textarea rows={2} placeholder="Building, Street..." className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder:text-white/30 focus:outline-none focus:bg-white/20 transition-all text-sm"
                            value={centerForm.address} onChange={e => setCenterForm({...centerForm, address: e.target.value})} />
                        </div>
                        <button type="submit" disabled={isCenterSubmitting} className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-red-600/20 transition-all">
                             {isCenterSubmitting ? <RefreshCw size={20} className="animate-spin" /> : <MapPin size={20} />}
                            Add Center
                        </button>
                    </form>
                </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: any = {
    High: "bg-red-100 text-red-700",
    Medium: "bg-orange-100 text-orange-700",
    Low: "bg-yellow-100 text-yellow-700"
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors[severity] || "bg-slate-100"}`}>
      {severity}
    </span>
  );
}