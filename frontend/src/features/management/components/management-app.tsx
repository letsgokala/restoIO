'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { localizeDefaultBranchName } from '../../../lib/i18n/labels';
import { apiRequest } from '../../../lib/api/client';
import { Brand } from '../../../components/shared/brand';
import { createRestaurantAsOwner, getAccessibleRestaurants, type ManagedBranch, type ManagedRestaurant, type TenantApi } from '../management.service';
import { BranchesPanel, RestaurantPanel, StaffPanel, TablesPanel } from './management-panels';
import { MenuPanel } from './menu-panel';
import { Field, PanelError, PanelHeader } from './management-shared';

type Tab = 'overview' | 'restaurant' | 'branches' | 'staff' | 'tables' | 'menu';
const tabs: { id: Tab; icon: string }[] = [{ id: 'overview', icon: '◫' }, { id: 'restaurant', icon: '✳' }, { id: 'branches', icon: '⌖' }, { id: 'staff', icon: '♙' }, { id: 'tables', icon: '▦' }, { id: 'menu', icon: '❋' }];
type StaffUser = { id: string; email: string; displayName: string; isPlatformAdmin: boolean };

export function ManagementApp() {
  const router = useRouter();
  const t = useTranslations('App');
  const roleLabels: Record<string, string> = { RESTAURANT_OWNER: t('roleRestaurantOwner'), MANAGER: t('roleManager'), WAITER: t('roleWaiter'), KITCHEN: t('roleKitchen'), CASHIER: t('roleCashier') };
  const [user, setUser] = useState<StaffUser | null>(null); const [restaurants, setRestaurants] = useState<ManagedRestaurant[]>([]); const [restaurantId, setRestaurantId] = useState(''); const [branchId, setBranchId] = useState(''); const [tab, setTab] = useState<Tab>('overview'); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0); const [creatingRestaurant, setCreatingRestaurant] = useState(false); const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId) ?? null;
  const branches = selectedRestaurant?.branches.filter((branch) => branch.isActive || branch.id === branchId) ?? [];
  const availableBranches: ManagedBranch[] = branches.map((b) => ({ ...b, slug: '', address: null }));
  const isOwner = selectedRestaurant?.role === 'RESTAURANT_OWNER';
  const isManager = isOwner || selectedRestaurant?.role === 'MANAGER';
  const canManageRestaurantContent = !!isOwner || (selectedRestaurant?.role === 'MANAGER' && selectedRestaurant.branchIds === null && !branchId);
  const api: TenantApi = useCallback((path, init = {}) => {
    if (!restaurantId) return Promise.reject(new Error(t('chooseRestaurantFirst')));
    const headers = new Headers(init.headers); headers.set('X-Restaurant-Id', restaurantId); if (branchId) headers.set('X-Branch-Id', branchId); else headers.delete('X-Branch-Id');
    return apiRequest(path, { ...init, headers });
  }, [branchId, restaurantId, t]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const identity = await apiRequest<{ user: StaffUser }>('/auth/me');
      if (identity.user.isPlatformAdmin) { router.replace('/platform'); return; }
      const available = await getAccessibleRestaurants();
      const canManageWorkspace = available.restaurants.some((restaurant) => ['RESTAURANT_OWNER', 'MANAGER'].includes(restaurant.role));
      if (!canManageWorkspace) {
        const roles = available.restaurants.map((restaurant) => restaurant.role);
        const destination = roles.includes('KITCHEN') ? '/kitchen' : roles.includes('WAITER') ? '/waiter' : roles.includes('CASHIER') ? '/cashier' : '';
        if (destination) { router.replace(destination); return; }
      }
      setUser(identity.user); setRestaurants(available.restaurants);
      const savedId = sessionStorage.getItem('restoio-management-restaurant');
      const next = available.restaurants.find((r) => r.id === savedId) ?? available.restaurants[0];
      if (next) {
        setRestaurantId(next.id);
        const savedBranch = sessionStorage.getItem(`restoio-management-branch:${next.id}`);
        const nextBranch = next.branchIds?.includes(savedBranch ?? '') ? savedBranch! : next.branchIds?.[0] ?? '';
        setBranchId(nextBranch);
      }
    } catch {
      setError(t('requestFailed'));
    } finally { setLoading(false); }
  }, [router, t]);
  useEffect(() => { void load(); }, [load]);
  const refresh = () => setRevision((v) => v + 1);
  const changeRestaurant = (id: string) => { const next = restaurants.find((r) => r.id === id); setRestaurantId(id); setBranchId(next?.branchIds?.[0] ?? ''); sessionStorage.setItem('restoio-management-restaurant', id); sessionStorage.removeItem(`restoio-management-branch:${id}`); };
  const changeBranch = (id: string) => { setBranchId(id); if (restaurantId) sessionStorage.setItem(`restoio-management-branch:${restaurantId}`, id); };
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { router.push('/login'); } };
  const createRestaurant = async (form: Record<string, string>) => {
    setError(''); setCreatingWorkspace(true);
    try {
      const body = { name: form.name, slug: form.slug, description: form.description || undefined, logoUrl: form.logoUrl || undefined, coverImageUrl: form.coverImageUrl || undefined, contactPhone: form.contactPhone || undefined, websiteUrl: form.websiteUrl || undefined, currency: form.currency || 'ETB', timezone: form.timezone || 'Africa/Addis_Ababa', branchName: form.branchName, branchSlug: form.branchSlug, branchAddress: form.branchAddress || undefined };
      const result = await createRestaurantAsOwner(body);
      const row = result as { restaurant: { id: string } }; sessionStorage.setItem('restoio-management-restaurant', row.restaurant.id);
      setCreatingRestaurant(false); await load(); setRestaurantId(row.restaurant.id); setBranchId('');
    } catch { setError(t('workspaceCreateFailed')); }
    finally { setCreatingWorkspace(false); }
  };
  const selectedTitle = selectedRestaurant?.name ?? t('restaurantWorkspace');
  const tabLabels: Record<Tab, string> = { overview: t('overview'), restaurant: t('restaurant'), branches: t('branches'), staff: t('team'), tables: t('tablesQr'), menu: t('menu') };

  if (loading) return <main className="management-loading"><div className="customer-loader"/><p>{t('openingWorkspace')}</p></main>;
  if (!user) return <main className="management-gate"><Brand/><div className="management-gate-card"><span className="management-gate-icon">♙</span><p className="customer-eyebrow">{t('staffWorkspace')}</p><h1 className="display-type">{error || t('signInManage')}</h1><a className="customer-primary" href="/login">{t('goStaffSignIn')}</a></div></main>;
  if (!restaurants.length) return <main className="management-gate"><Brand/><div className="management-gate-card"><span className="management-gate-icon">✳</span><p className="customer-eyebrow">{t('restaurantWorkspace')}</p><h1 className="display-type">{t('noRestaurantAssigned')}</h1><p className="management-gate-copy">{t('askAdminWorkspace')}</p>{error && <p role="alert" className="management-alert">{error}</p>}</div></main>;
  return <main className="management-shell">{creatingRestaurant && error && <WorkspaceErrorToast message={error} onDismiss={() => setError('')} />}
    <aside className="management-sidebar"><div className="management-brand"><Brand/><span className="management-workspace-label">{t('restaurantWorkspace')}</span></div><div className="management-restaurant-picker"><label htmlFor="management-restaurant">{t('workspace')}</label><select id="management-restaurant" value={restaurantId} onChange={(e) => changeRestaurant(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{selectedRestaurant?.branchIds === null && <label htmlFor="management-branch">{t('branch')}</label>}{selectedRestaurant?.branchIds === null && <select id="management-branch" value={branchId} onChange={(e) => changeBranch(e.target.value)}><option value="">{t('allBranches')}</option>{branches.map((b) => <option key={b.id} value={b.id}>{localizeDefaultBranchName(b.name, t('mainBranch'))}</option>)}</select>}{selectedRestaurant?.branchIds && selectedRestaurant.branchIds.length > 1 && <><label htmlFor="management-branch">{t('assignedBranch')}</label><select id="management-branch" value={branchId} onChange={(e) => changeBranch(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{localizeDefaultBranchName(b.name, t('mainBranch'))}</option>)}</select></>}</div><nav className="management-nav" aria-label={t('manageSections')}>{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span>{item.icon}</span>{tabLabels[item.id]}{tab === item.id && <i/>}</button>)}</nav><div className="management-sidebar-bottom"><div className="staff-profile"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[selectedRestaurant?.role ?? ''] ?? selectedRestaurant?.role}</small></div></div><button className="management-logout" onClick={() => void logout()}>{t('signOut')} <span>↗</span></button></div></aside>
    <section className="management-main"><header className="management-topbar"><div><p className="customer-eyebrow">{selectedTitle} <span>·</span> {t('workspace')}</p><h1>{tabLabels[tab]}</h1></div><div className="management-top-actions">{canManageRestaurantContent && <a className="management-secondary" href="/analytics">{t('reportsAnalytics')}</a>}{isOwner && <button className="management-secondary" onClick={() => setCreatingRestaurant(true)}>＋ {t('addRestaurant')}</button>}<button className="management-avatar" title={user.email}>{user.displayName.slice(0, 1).toUpperCase()}</button></div></header>{error && <p role="alert" className="management-alert">{error}<button onClick={() => setError('')}>×</button></p>}
      <div className="management-content" key={`${restaurantId}:${branchId}:${tab}`}>
        {tab === 'overview' && <OverviewPanel api={api} revision={revision} canManage={!!isManager} onNavigate={setTab}/>}
        {tab === 'restaurant' && <RestaurantPanel api={api} revision={revision} canWrite={canManageRestaurantContent}/>}
        {tab === 'branches' && <BranchesPanel api={api} revision={revision} canWrite={!!isOwner} onChanged={refresh}/>}
        {tab === 'staff' && <StaffPanel api={api} branches={availableBranches} revision={revision} canWrite={!!isOwner} onChanged={refresh}/>}
        {tab === 'tables' && <TablesPanel api={api} branches={availableBranches} revision={revision} canWrite={!!isManager} onChanged={refresh}/>}
        {tab === 'menu' && <MenuPanel api={api} branches={availableBranches} revision={revision} canWrite={canManageRestaurantContent} onChanged={refresh}/>}
      </div>
    </section>{creatingRestaurant && <RestaurantCreateDialog error={error} submitting={creatingWorkspace} onClose={() => { setCreatingRestaurant(false); setError(''); }} onSubmit={createRestaurant}/>}
  </main>;
}

function WorkspaceErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const t = useTranslations('App');
  return <div className="workspace-error-toast" role="alert" aria-live="assertive"><span aria-hidden="true">!</span><div><strong>{t('workspaceCreateFailed')}</strong><p>{message}</p></div><button type="button" aria-label={t('dismissCreateError')} onClick={onDismiss}>×</button></div>;
}

function OverviewPanel({ api, revision, canManage, onNavigate }: { api: TenantApi; revision: number; canManage: boolean; onNavigate: (tab: Tab) => void }) {
  const t = useTranslations('App');
  const [summary, setSummary] = useState<{ branches: number; staff: number; tables: number; categories: number; items: number } | null>(null);
  useEffect(() => { let active = true; Promise.all([api<any>('/tenant/branches'), api<any>('/tenant/staff'), api<any>('/tenant/tables'), api<any>('/tenant/menu')]).then(([branches, staff, tables, menu]) => { if (active) setSummary({ branches: branches.length, staff: staff.length, tables: tables.length, categories: menu.length, items: menu.reduce((n: number, c: any) => n + c.items.length, 0) }); }).catch(() => { if (active) setSummary(null); }); return () => { active = false; }; }, [api, revision]);
  return <><div className="management-welcome"><div><span className="management-welcome-orbit">✳</span><p className="customer-eyebrow">{t('clearViewService')}</p><h2 className="display-type">{t('goodToSeeYou')}</h2><p>{t('overviewCopy')}</p></div><div className="welcome-table-art"><svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 29h28c0 5.5-4.5 10-10 10h-8c-5.5 0-10-4.5-10-10Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/><path d="M15 28c.7-8 4-13 9-13s8.3 5 9 13M22 12a2 2 0 1 1 4 0v2h-4v-2Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/><path d="M7 42h34" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg><small>{t('hospitalityConsidered')}</small></div></div><div className="management-stat-grid">{[{ label: t('branches'), value: summary?.branches, tab: 'branches' as Tab, icon: '⌖' }, { label: t('teamMembers'), value: summary?.staff, tab: 'staff' as Tab, icon: '♙' }, { label: t('tables'), value: summary?.tables, tab: 'tables' as Tab, icon: '▦' }, { label: t('menuItems'), value: summary?.items, tab: 'menu' as Tab, icon: '❋' }].map((stat) => <button className="management-stat" key={stat.label} onClick={() => onNavigate(stat.tab)}><span>{stat.icon}</span><small>{stat.label}</small><strong>{stat.value ?? '—'}</strong><i>{t('viewSection', { section: stat.label.toLowerCase() })} →</i></button>)}</div><section className="management-card quickstart"><div><p className="customer-eyebrow">{t('nextSteps')}</p><h2>{t('makeTableYours')}</h2><p>{t('quickstartCopy')}</p></div><div className="quickstart-actions"><button onClick={() => onNavigate('tables')}>{t('setupTables')} <span>→</span></button><button onClick={() => onNavigate('menu')}>{t('manageMenu')} <span>→</span></button></div></section>{!canManage && <p className="management-hint">{t('readOnlyNotice')}</p>}</>;
}

function RestaurantCreateDialog({ error, submitting, onClose, onSubmit }: { error: string; submitting: boolean; onClose: () => void; onSubmit: (form: Record<string, string>) => Promise<void> }) {
  const t = useTranslations('App');
  const [form, setForm] = useState({ name: '', slug: '', description: '', logoUrl: '', coverImageUrl: '', contactPhone: '', websiteUrl: '', currency: 'ETB', timezone: 'Africa/Addis_Ababa', branchName: t('mainBranch'), branchSlug: 'main', branchAddress: '' });
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  return <div className="management-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}><form className="management-modal workspace-create-modal" aria-busy={submitting} onSubmit={(e) => { e.preventDefault(); if (!submitting) void onSubmit(form); }}>
    <button className="management-modal-close" type="button" aria-label={t('closeCreateWorkspace')} disabled={submitting} onClick={onClose}>×</button>
    <div className="workspace-modal-heading"><span className="workspace-modal-mark" aria-hidden="true">✳</span><div><p className="customer-eyebrow">{t('newWorkspace')}</p><h2 className="display-type">{t('setupRestaurant')}</h2><p>{t('createRestaurantCopy')}</p></div></div>
    {error && <p className="management-alert workspace-modal-error" role="alert">{error}</p>}
    <div className="management-form-grid">
      <div className="workspace-form-section"><span>01</span><div><strong>{t('restaurantDetails')}</strong><small>{t('restaurantProfileHint')}</small></div></div>
      <Field label={t('restaurantName')} value={form.name} onChange={(v) => { set('name', v); if (!form.slug) set('slug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/>
      <Field label={t('workspaceSlug')} value={form.slug} onChange={(v) => set('slug', v)} required hint={t('slugFormatHint')}/>
      <Field label={t('description')} value={form.description} onChange={(v) => set('description', v)} wide/>
      <Field label={t('currencyCode')} value={form.currency} onChange={(v) => set('currency', v.toUpperCase())} required hint={t('currencyExample')}/>
      <Field label={t('timezone')} value={form.timezone} onChange={(v) => set('timezone', v)} required/>
      <div className="workspace-form-section"><span>02</span><div><strong>{t('firstBranch')}</strong><small>{t('mainLocationHint')}</small></div></div>
      <Field label={t('branchName')} value={form.branchName} onChange={(v) => { set('branchName', v); if (!form.branchSlug || form.branchSlug === 'main') set('branchSlug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/>
      <Field label={t('branchSlug')} value={form.branchSlug} onChange={(v) => set('branchSlug', v)} required/>
      <Field label={t('address')} value={form.branchAddress} onChange={(v) => set('branchAddress', v)} wide/>
    </div>
    <div className="management-modal-actions"><button type="button" className="management-secondary" disabled={submitting} onClick={onClose}>{t('cancel')}</button><button type="submit" className="management-primary" disabled={submitting}>{submitting ? <><span className="workspace-button-spinner" aria-hidden="true"/> {t('creatingWorkspace')}</> : t('createWorkspace')}</button></div>
  </form></div>;
}

