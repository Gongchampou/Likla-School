import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SchoolSettings, User } from '../types';
import { isSettingsSectionVisible } from '../utils/visibility';
import { SaveIcon, PaletteIcon, FontSizeIcon, UploadIcon, FileDownIcon, SettingsIcon } from '../components/icons';
import { useI18n } from '../i18n';

interface SettingsProps {
    settings: SchoolSettings;
    onSave: (newSettings: Partial<SchoolSettings>) => void;
    currentUser: User;
}

const colorOptions = [
    { name: 'Indigo', value: '#4F46E5', class: 'bg-indigo-500' },
    { name: 'Sky', value: '#0EA5E9', class: 'bg-sky-500' },
    { name: 'Emerald', value: '#10B981', class: 'bg-emerald-500' },
    { name: 'Rose', value: '#F43F5E', class: 'bg-rose-500' },
    { name: 'Amber', value: '#F59E0B', class: 'bg-amber-500' },
];

const fontSizeOptions: { name: string, value: SchoolSettings['fontSize'], class: string }[] = [
    { name: 'Small', value: 'sm', class: 'text-sm' },
    { name: 'Normal', value: 'base', class: 'text-base' },
    { name: 'Large', value: 'lg', class: 'text-lg' },
];

const SettingsCard: React.FC<{ title: string; description: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, description, icon, children }) => (
    <div className="bg-card dark:bg-dark-card shadow-md rounded-lg border border-border dark:border-dark-border">
        <div className="p-6 border-b border-border dark:border-dark-border">
            <div className="flex items-start space-x-4">
                <div className="bg-primary/10 text-primary p-3 rounded-lg">{icon}</div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground mt-1">{description}</p>
                </div>
            </div>
        </div>
        <div className="p-6 space-y-6">{children}</div>
    </div>
);

const Settings: React.FC<SettingsProps> = ({ settings, onSave, currentUser }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [isDirty, setIsDirty] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [trialRunning, setTrialRunning] = useState(false);
    const [trialResult, setTrialResult] = useState<{ userId?: string; fileUrl?: string; message?: string } | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [settingsControls, setSettingsControls] = useState<Record<string, Record<string, boolean>>>({});

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        setIsDirty(JSON.stringify(localSettings) !== JSON.stringify(settings));
    }, [localSettings, settings]);

    // Load visibility controls for Settings sections from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('settingsControls');
            if (saved) {
                setSettingsControls(JSON.parse(saved));
            } else {
                setSettingsControls({});
            }
        } catch {
            setSettingsControls({});
        }
    }, []);

    const isSectionVisible = (key: string) => isSettingsSectionVisible(currentUser.role as any, key);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleRunFullTrial = async () => {
        setTrialResult(null);
        const provider = localSettings.storageProvider || 'firebase';
        const url = (localSettings.supabaseUrl || '').trim();
        const key = (localSettings.supabaseAnonKey || '').trim();
        const bucket = (localSettings.supabaseBucket || 'public').trim();
        if (provider !== 'supabase') {
            setTrialResult({ message: 'Set Storage Provider to Supabase to run full trial.' });
            return;
        }
        if (!url || !key) {
            setTrialResult({ message: 'Please provide Supabase URL and Anon Key.' });
            return;
        }
        try {
            setTrialRunning(true);
            const client = createClient(url, key, { auth: { persistSession: false } });
            const trialId = `trial-${Date.now()}`;
            // 1) Insert a minimal trial user
            const trialUser = {
                id: trialId,
                name: 'Trial User',
                email: `${trialId}@example.com`,
                role: 'Staff', // expecting text role in table
                profilePicture: ''
            } as any;
            const { error: upErr } = await client.from('users').upsert([trialUser], { onConflict: 'id' });
            if (upErr) {
                setTrialResult({ message: `User upsert failed: ${upErr.message}` });
                return;
            }
            // 2) Upload a small file to storage and get public URL
            const path = `trial/${trialId}.txt`;
            const blob = new Blob([`LIKLA trial upload for ${trialId} @ ${new Date().toISOString()}`], { type: 'text/plain' });
            const { error: upFileErr } = await client.storage.from(bucket).upload(path, blob, { contentType: 'text/plain', upsert: false });
            if (upFileErr) {
                setTrialResult({ userId: trialId, message: `Storage upload failed: ${upFileErr.message}` });
                return;
            }
            const { data } = client.storage.from(bucket).getPublicUrl(path);
            setTrialResult({ userId: trialId, fileUrl: data.publicUrl, message: 'Trial succeeded.' });
        } catch (e: any) {
            setTrialResult({ message: `Trial failed: ${(e && e.message) || 'Unknown error'}` });
        } finally {
            setTrialRunning(false);
        }
    };
    
    const handleValueChange = (name: keyof SchoolSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(localSettings);
    };

    // Utilities
    const handleExport = () => {
        const dataStr = JSON.stringify(localSettings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'school-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || '{}')) as Partial<SchoolSettings>;
                setLocalSettings(prev => ({ ...prev, ...parsed }));
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
        // reset input so selecting the same file again triggers change
        e.currentTarget.value = '';
    };

    const handleReset = () => {
        if (!confirm('Reset settings to defaults? This will reload the page.')) return;
        localStorage.removeItem('schoolSettings');
        window.location.reload();
    };

    const handleTestSupabase = async () => {
        setTestResult(null);
        const url = (localSettings.supabaseUrl || '').trim();
        const key = (localSettings.supabaseAnonKey || '').trim();
        if (!url || !key) {
            setTestResult('Please provide Supabase URL and Anon Key.');
            return;
        }
        try {
            setTesting(true);
            const client = createClient(url, key, { auth: { persistSession: false } });
            // Lightweight check: list users table head-only (requires RLS allowing select)
            const { error } = await client.from('users').select('id', { count: 'exact', head: true });
            if (error) {
                setTestResult(`Connected, but query failed: ${error.message}`);
            } else {
                setTestResult('Success: Supabase credentials are valid and query succeeded.');
            }
        } catch (e: any) {
            setTestResult(`Failed: ${(e && e.message) || 'Unknown error'}`);
        } finally {
            setTesting(false);
        }
    };

    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const setupSql = `-- USERS table
create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null,
  role text not null,
  profilePicture text,
  displayId text,
  dobYear text,
  dob text,
  passwordHash text,
  classId text,
  attendance jsonb,
  fees jsonb,
  discount int,
  whatsapp text,
  salary numeric
);

-- Deleted snapshots bin
create table if not exists public.users_bin (
  id uuid primary key default gen_random_uuid(),
  user jsonb not null,
  affected_classes jsonb,
  affected_assignments jsonb,
  deleted_at text not null
);

-- Enable RLS
alter table public.users enable row level security;
alter table public.users_bin enable row level security;

-- Permissive policies for testing (tighten later)
drop policy if exists "users anon all" on public.users;
create policy "users anon all" on public.users for all to anon using (true) with check (true);

drop policy if exists "users_bin anon all" on public.users_bin;
create policy "users_bin anon all" on public.users_bin for all to anon using (true) with check (true);`;
    const copySetupSql = async () => {
        try {
            await navigator.clipboard.writeText(setupSql);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Copy failed', e);
        }
    };

    return (
        <>
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.Settings')}</h2>
                <button
                    onClick={handleSave}
                    disabled={!isDirty}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                    <SaveIcon className="-ml-1 mr-2 h-5 w-5" /> {isDirty ? t('settings.SaveChanges') : t('settings.Saved')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {isSectionVisible('general') && (
                    <SettingsCard title={t('settings.General')} description="Localization and pagination preferences." icon={<SettingsIcon />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.Language')}</label>
                                <select
                                    name="language"
                                    value={localSettings.language || 'en'}
                                    onChange={e => handleValueChange('language', e.target.value as any)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                >
                                    <option value="en">English</option>
                                    <option value="fr">Français</option>
                                    <option value="hi">हिन्दी</option>
                                    <option value="es">Español</option>
                                    <option value="de">Deutsch</option>
                                    <option value="ar">العربية</option>
                                    <option value="bn">বাংলা</option>
                                    <option value="ta">தமிழ்</option>
                                    <option value="te">తెలుగు</option>
                                    <option value="mr">मराठी</option>
                                    <option value="gu">ગુજરાતી</option>
                                    <option value="pa">ਪੰਜਾਬੀ</option>
                                    <option value="ur">اُردو</option>
                                    <option value="zh">中文</option>
                                    <option value="ja">日本語</option>
                                    <option value="ru">Русский</option>
                                    <option value="pt">Português</option>
                                    <option value="it">Italiano</option>
                                    <option value="mni">Meitei (Manipuri)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.DateFormat')}</label>
                                <select
                                    name="dateFormat"
                                    value={localSettings.dateFormat || 'DD/MM/YYYY'}
                                    onChange={e => handleValueChange('dateFormat', e.target.value as any)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                >
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.ItemsPerPage')}</label>
                                <select
                                    name="itemsPerPage"
                                    value={localSettings.itemsPerPage || 25}
                                    onChange={e => handleValueChange('itemsPerPage', Number(e.target.value) as any)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.AcademicYear')}</label>
                                <input
                                    type="text"
                                    name="academicYear"
                                    value={localSettings.academicYear || ''}
                                    onChange={e => handleValueChange('academicYear', e.target.value)}
                                    placeholder="2024-2025"
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                />
                            </div>
                        </div>
                    </SettingsCard>
                    )}
                    {isSectionVisible('schoolInfo') && (
                    <SettingsCard title={t('settings.SchoolInformation')} description="Update your school's name and logo." icon={<SettingsIcon />}>
                        <div>
                            <label htmlFor="schoolName" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.SchoolName')}</label>
                            <input type="text" name="schoolName" id="schoolName" value={localSettings.schoolName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                        </div>
                         <div>
                            <label htmlFor="schoolLogo" className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.SchoolLogoUrl')}</label>
                            <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-3">
                               <img src={localSettings.schoolLogo} alt="Logo Preview" className="h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-gray-200 object-contain p-1" />
                               <input type="url" name="schoolLogo" id="schoolLogo" value={localSettings.schoolLogo} onChange={handleInputChange} className="block w-full rounded-md border-border dark:border-dark-border shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-muted dark:bg-dark-muted p-2" />
                            </div>
                        </div>
                    </SettingsCard>
                    )}

                    {/* Storage Provider Configuration (Super Admin recommended) */}
                    {isSectionVisible('storage') && (
                    <SettingsCard title="Storage" description="Configure where files are stored. Choose Supabase to avoid Firebase billing." icon={<SettingsIcon />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Provider</label>
                                <select
                                    value={localSettings.storageProvider || 'firebase'}
                                    onChange={e => handleValueChange('storageProvider', e.target.value as any)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                >
                                    <option value="firebase">Firebase</option>
                                    <option value="supabase">Supabase</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Supabase Bucket</label>
                                <input
                                    type="text"
                                    placeholder="public"
                                    value={localSettings.supabaseBucket || ''}
                                    onChange={e => handleValueChange('supabaseBucket', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Supabase URL</label>
                                <input
                                    type="url"
                                    placeholder="https://YOUR-PROJECT.supabase.co"
                                    value={localSettings.supabaseUrl || ''}
                                    onChange={e => handleValueChange('supabaseUrl', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">Supabase Anon Key</label>
                                <input
                                    type="password"
                                    placeholder="Paste anon key"
                                    value={localSettings.supabaseAnonKey || ''}
                                    onChange={e => handleValueChange('supabaseAnonKey', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                />
                                <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-1">Store anon keys only. Service keys should not be placed in the browser.</p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleTestSupabase}
                                        disabled={testing}
                                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:bg-gray-400"
                                    >
                                        {testing ? 'Testing…' : 'Test Supabase Connection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRunFullTrial}
                                        disabled={trialRunning}
                                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:bg-gray-400"
                                    >
                                        {trialRunning ? 'Running Trial…' : 'Run Full Trial (DB + Storage)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowGuide(true)}
                                        className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white hover:bg-accent dark:hover:bg-dark-accent"
                                    >
                                        Supabase Setup Guide
                                    </button>
                                    {testResult && (
                                        <span className="text-sm text-muted-foreground dark:text-dark-muted-foreground">{testResult}</span>
                                    )}
                                </div>
                                {trialResult && (
                                    <div className="mt-2 text-xs text-muted-foreground dark:text-dark-muted-foreground space-y-1">
                                        {trialResult.message && <div>{trialResult.message}</div>}
                                        {trialResult.userId && <div>Created trial user ID: <code>{trialResult.userId}</code></div>}
                                        {trialResult.fileUrl && (
                                            <div>
                                                Uploaded file URL: <a className="text-primary underline" href={trialResult.fileUrl} target="_blank" rel="noreferrer">{trialResult.fileUrl}</a>
                                            </div>
                                        )}
                                        {!trialResult.fileUrl && (localSettings.storageProvider || 'firebase') === 'supabase' && (
                                            <div>Note: Ensure bucket "{localSettings.supabaseBucket || 'public'}" exists and has public read or appropriate access policy.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </SettingsCard>
                    )}

                     {isSectionVisible('utilities') && (
                     <SettingsCard title={t('settings.Utilities')} description="Export/import settings and reset to defaults." icon={<FileDownIcon />}>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleExport}
                                className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-accent dark:hover:bg-dark-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <FileDownIcon className="-ml-1 mr-2 h-5 w-5" /> {t('settings.ExportSettingsJSON')}
                            </button>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <UploadIcon className="w-5 h-5" />
                                <span className="text-sm">{t('settings.ImportSettingsJSON')}</span>
                                <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
                            </label>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center justify-center rounded-md border border-red-300 text-red-600 bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                            >
                                {t('settings.ResetToDefaults')}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground mt-2">Importing will merge with current settings. Reset clears saved settings and reloads.</p>
                    </SettingsCard>
                     )}
                </div>

                <div className="lg:col-span-1 space-y-8">
                    {isSectionVisible('appearance') && (
                    <SettingsCard title={t('settings.Appearance')} description="Customize the look and feel of the application." icon={<PaletteIcon />}>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.Theme')}</label>
                            <div className="mt-2 flex rounded-md shadow-sm">
                                <button type="button" onClick={() => handleValueChange('theme', 'light')} className={`relative inline-flex items-center w-1/2 justify-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border dark:ring-dark-border focus:z-10 ${localSettings.theme === 'light' ? 'bg-primary text-white' : 'bg-card dark:bg-dark-card hover:bg-accent dark:hover:bg-dark-accent'}`}>
                                    Light
                                </button>
                                <button type="button" onClick={() => handleValueChange('theme', 'dark')} className={`-ml-px relative inline-flex items-center w-1/2 justify-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border dark:ring-dark-border focus:z-10 ${localSettings.theme === 'dark' ? 'bg-primary text-white' : 'bg-card dark:bg-dark-card hover:bg-accent dark:hover:bg-dark-accent'}`}>
                                    Dark
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.PrimaryColor')}</label>
                            <div className="mt-2 flex items-center space-x-3">
                                {colorOptions.map(color => (
                                    <button key={color.name} type="button" title={color.name} onClick={() => handleValueChange('primaryColor', color.value)} className={`w-8 h-8 rounded-full ${color.class} flex items-center justify-center ring-2 ring-offset-2 dark:ring-offset-dark-card ${localSettings.primaryColor === color.value ? 'ring-primary' : 'ring-transparent'}`}>
                                        {localSettings.primaryColor === color.value && <div className="w-3 h-3 rounded-full bg-white"></div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.FontSize')}</label>
                             <div className="mt-2 flex rounded-md shadow-sm">
                                {fontSizeOptions.map((opt, index) => (
                                     <button key={opt.value} type="button" onClick={() => handleValueChange('fontSize', opt.value)} className={`-ml-px relative inline-flex items-center w-1/3 justify-center px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border dark:ring-dark-border focus:z-10 ${index === 0 ? 'rounded-l-md' : ''} ${index === fontSizeOptions.length-1 ? 'rounded-r-md' : ''} ${localSettings.fontSize === opt.value ? 'bg-primary text-white' : 'bg-card dark:bg-dark-card hover:bg-accent dark:hover:bg-dark-accent'}`}>
                                        {opt.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mt-4">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={Boolean(localSettings.sidebarCompact)} onChange={e => handleValueChange('sidebarCompact', e.target.checked)} />
                                {t('settings.CompactSidebar')}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={Boolean(localSettings.sidebarCollapsedByDefault)} onChange={e => handleValueChange('sidebarCollapsedByDefault', e.target.checked)} />
                                Collapse sidebar by default (desktop)
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={localSettings.animations !== false} onChange={e => handleValueChange('animations', e.target.checked)} />
                                {t('settings.EnableAnimations')}
                            </label>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.Density')}</label>
                                <select
                                    value={localSettings.density || 'comfortable'}
                                    onChange={e => handleValueChange('density', e.target.value as any)}
                                    className="mt-1 block w-full rounded-md border-border dark:border-dark-border bg-muted dark:bg-dark-muted p-2"
                                >
                                    <option value="comfortable">Comfortable</option>
                                    <option value="compact">Compact</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground">{t('settings.Notifications')}</label>
                                <div className="mt-2 space-y-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={Boolean(localSettings.notifyEmail)} onChange={e => handleValueChange('notifyEmail', e.target.checked)} />
                                        {t('settings.EmailNotifications')}
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={Boolean(localSettings.notifySms)} onChange={e => handleValueChange('notifySms', e.target.checked)} />
                                        {t('settings.SMSNotifications')}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </SettingsCard>
                    )}
                </div>
            </div>
        </div>
        {showGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setShowGuide(false)} />
                <div className="relative z-10 max-w-3xl w-full mx-4 rounded-lg border border-border dark:border-dark-border bg-card dark:bg-dark-card shadow-lg">
                    <div className="p-4 border-b border-border dark:border-dark-border flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Supabase Setup Guide</h3>
                        <button onClick={() => setShowGuide(false)} className="text-sm text-muted-foreground hover:underline">Close</button>
                    </div>
                    <div className="p-4 space-y-4 text-sm text-gray-800 dark:text-gray-200 max-h-[70vh] overflow-auto">
                        <p><strong>Purpose:</strong> After deploying, each super admin must configure their own Supabase project so this app can store users and files.</p>
                        <ol className="list-decimal pl-5 space-y-3">
                            <li>
                                <strong>Create/Select your Supabase project</strong> and copy:
                                <ul className="list-disc pl-5">
                                    <li>Project URL</li>
                                    <li>Anon public API key</li>
                                </ul>
                                Paste these in Settings → Storage.
                            </li>
                            <li>
                                <strong>Create tables</strong> in SQL Editor:
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className="text-xs text-muted-foreground dark:text-dark-muted-foreground">Copy and paste into Supabase SQL Editor</span>
                                    <button onClick={copySetupSql} className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-2 py-1 text-xs font-medium text-gray-900 dark:text-white hover:bg-accent dark:hover:bg-dark-accent">
                                        {copied ? 'Copied!' : 'Copy SQL'}
                                    </button>
                                </div>
                                <pre className="whitespace-pre-wrap bg-muted dark:bg-dark-muted p-3 rounded text-xs overflow-auto">{setupSql}</pre>
                            </li>
                            <li>
                                <strong>Create a Storage bucket</strong> in Storage → Create bucket:
                                <ul className="list-disc pl-5">
                                    <li>Name must match Settings → Supabase Bucket (e.g. <code>public</code>).</li>
                                    <li>Mark as Public or add policies to allow reads.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Test</strong>: Use "Test Supabase Connection" and "Run Full Trial" buttons. You should see a trial user ID and a public file URL.
                            </li>
                            <li>
                                <strong>Security</strong>:
                                <ul className="list-disc pl-5">
                                    <li>Only use the <em>Anon</em> key in the browser. Never use service keys here.</li>
                                    <li>Replace permissive test policies with tighter RLS suited to your deployment.</li>
                                </ul>
                            </li>
                        </ol>
                    </div>
                    <div className="p-4 border-t border-border dark:border-dark-border flex justify-end">
                        <button onClick={() => setShowGuide(false)} className="inline-flex items-center justify-center rounded-md border border-border dark:border-dark-border bg-card dark:bg-dark-card px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-accent dark:hover:bg-dark-accent">Close</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default Settings;