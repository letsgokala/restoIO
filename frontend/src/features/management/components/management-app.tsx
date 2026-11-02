'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, apiRequest } from '../../../lib/api/client';
import { Brand } from '../../../components/shared/brand';
import { createRestaurantAsOwner, createRestaurantAsPlatformAdmin, getAccessibleRestaurants, type ManagedBranch, type ManagedRestaurant, type TenantApi } from '../management.service';
import { BranchesPanel, RestaurantPanel, StaffPanel, TablesPanel } from './management-panels';
import { MenuPanel } from './menu-panel';
import { Field, PanelError, PanelHeader } from './management-shared';

type Tab = 'overview' | 'restaurant' | 'branches' | 'staff' | 'tables' | 'menu';
const tabs: { id: Tab; label: string; icon: string }[] = [{ id: 'overview', label: 'Overview', icon: '◫' }, { id: 'restaurant', label: 'Restaurant', icon: '✳' }, { id: 'branches', label: 'Branches', icon: '⌖' }, { id: 'staff', label: 'Team', icon: '♙' }, { id: 'tables', label: 'Tables & QR', icon: '▦' }, { id: 'menu', label: 'Menu', icon: '❋' }];
type StaffUser = { id: string; email: string; displayName: string; isPlatformAdmin: boolean };
const validationFieldLabels: Record<string, string> = { name: 'Restaurant name', slug: 'Workspace URL slug', description: 'Description', currency: 'Currency code', timezone: 'Timezone', branchName: 'Branch name', branchSlug: 'Branch URL slug', branchAddress: 'Branch address', ownerName: 'Owner name', ownerEmail: 'Owner email', password: 'Temporary password' };
function explainApiError(error: ApiClientError) {
  const details = error.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
  const fieldIssues = Object.entries(details?.fieldErrors ?? {}).flatMap(([field, messages]) => messages.map((message) => `${validationFieldLabels[field] ?? field}: ${message}`));
  const allIssues = [...(details?.formErrors ?? []), ...fieldIssues];
  return allIssues.length ? `${error.message}\n${allIssues.join('\n')}` : error.message;
}

export function ManagementApp() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null); const [restaurants, setRestaurants] = useState<ManagedRestaurant[]>([]); const [restaurantId, setRestaurantId] = useState(''); const [branchId, setBranchId] = useState(''); const [tab, setTab] = useState<Tab>('overview'); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0); const [creatingRestaurant, setCreatingRestaurant] = useState(false); const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId) ?? null;
  const branches = selectedRestaurant?.branches.filter((branch) => branch.isActive || branch.id === branchId) ?? [];
  const availableBranches: ManagedBranch[] = branches.map((b) => ({ ...b, slug: '', address: null }));
  const isOwner = selectedRestaurant?.role === 'RESTAURANT_OWNER' || selectedRestaurant?.role === 'PLATFORM_ADMIN';
  const isManager = isOwner || selectedRestaurant?.role === 'MANAGER';
  const canManageRestaurantContent = !!isOwner || (selectedRestaurant?.role === 'MANAGER' && selectedRestaurant.branchIds === null && !branchId);
  const api: TenantApi = useCallback((path, init = {}) => {
    if (!restaurantId) return Promise.reject(new Error('Select a restaurant first'));
    const headers = new Headers(init.headers); headers.set('X-Restaurant-Id', restaurantId); if (branchId) headers.set('X-Branch-Id', branchId); else headers.delete('X-Branch-Id');
    return apiRequest(path, { ...init, headers });
  }, [branchId, restaurantId]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [identity, available] = await Promise.all([apiRequest<{ user: StaffUser }>('/auth/me'), getAccessibleRestaurants()]);
      setUser(identity.user); setRestaurants(available.restaurants);
      const savedId = sessionStorage.getItem('restoio-management-restaurant');
      const next = available.restaurants.find((r) => r.id === savedId) ?? available.restaurants[0];
      if (next) {
        setRestaurantId(next.id);
        const savedBranch = sessionStorage.getItem(`restoio-management-branch:${next.id}`);
        const nextBranch = next.branchIds?.includes(savedBranch ?? '') ? savedBranch! : next.branchIds?.[0] ?? '';
        setBranchId(nextBranch);
      }
    } catch (e) {
      setError(e instanceof ApiClientError && e.status === 401 ? 'Your staff session has expired. Sign in to continue.' : e instanceof Error ? e.message : 'Could not load the workspace.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const refresh = () => setRevision((v) => v + 1);
  const changeRestaurant = (id: string) => { const next = restaurants.find((r) => r.id === id); setRestaurantId(id); setBranchId(next?.branchIds?.[0] ?? ''); sessionStorage.setItem('restoio-management-restaurant', id); sessionStorage.removeItem(`restoio-management-branch:${id}`); };
  const changeBranch = (id: string) => { setBranchId(id); if (restaurantId) sessionStorage.setItem(`restoio-management-branch:${restaurantId}`, id); };
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { router.push('/login'); } };
  const createRestaurant = async (form: Record<string, string>) => {
    setError(''); setCreatingWorkspace(true);
    try {
      const body = { name: form.name, slug: form.slug, description: form.description || undefined, logoUrl: form.logoUrl || undefined, coverImageUrl: form.coverImageUrl || undefined, contactPhone: form.contactPhone || undefined, websiteUrl: form.websiteUrl || undefined, currency: form.currency || 'ETB', timezone: form.timezone || 'Africa/Addis_Ababa', branchName: form.branchName, branchSlug: form.branchSlug, branchAddress: form.branchAddress || undefined };
      const result = user?.isPlatformAdmin ? await createRestaurantAsPlatformAdmin({ ...body, ownerEmail: form.ownerEmail, ownerName: form.ownerName, password: form.password }) : await createRestaurantAsOwner(body);
      const row = result as { restaurant: { id: string } }; sessionStorage.setItem('restoio-management-restaurant', row.restaurant.id);
      setCreatingRestaurant(false); await load(); setRestaurantId(row.restaurant.id); setBranchId('');
    } catch (e) { setError(e instanceof ApiClientError ? explainApiError(e) : e instanceof Error ? e.message : 'Could not create the restaurant.'); }
    finally { setCreatingWorkspace(false); }
  };
  const selectedTitle = useMemo(() => selectedRestaurant?.name ?? 'Restaurant workspace', [selectedRestaurant]);

  if (loading) return <main className="management-loading"><div className="customer-loader"/><p>Opening your workspace…</p></main>;
  if (!user) return <main className="management-gate"><Brand/><div className="management-gate-card"><span className="management-gate-icon">♙</span><p className="customer-eyebrow">Staff workspace</p><h1 className="display-type">{error || 'Sign in to manage your restaurant.'}</h1><a className="customer-primary" href="/login">Go to staff sign in</a></div></main>;
  if (!restaurants.length) return <main className="management-gate">{creatingRestaurant && error && <WorkspaceErrorToast message={error} onDismiss={() => setError('')}/>}<Brand/><div className="management-gate-card"><span className="management-gate-icon">✳</span><p className="customer-eyebrow">{user.isPlatformAdmin ? 'PLATFORM SETUP' : `WELCOME, ${user.displayName.toUpperCase()}`}</p><h1 className="display-type">{user.isPlatformAdmin ? 'Your first restaurant workspace' : 'No restaurant is assigned to this account yet.'}</h1><p className="management-gate-copy">{user.isPlatformAdmin ? 'Create a restaurant account and its first branch. You can add tables, staff, and menu items from the workspace.' : 'Ask your restaurant administrator to add your account to a workspace.'}</p>{user.isPlatformAdmin && <button className="management-primary" onClick={() => { setError(''); setCreatingRestaurant(true); }}>Create restaurant workspace <span aria-hidden="true">→</span></button>}{error && !creatingRestaurant && <p role="alert" className="management-alert">{error}</p>}</div>{creatingRestaurant && <RestaurantCreateDialog platformAdmin={user.isPlatformAdmin} error={error} submitting={creatingWorkspace} onClose={() => { setCreatingRestaurant(false); setError(''); }} onSubmit={createRestaurant}/>}</main>;
  return <main className="management-shell">{creatingRestaurant && error && <WorkspaceErrorToast message={error} onDismiss={() => setError('')} />}
    <aside className="management-sidebar"><div className="management-brand"><Brand/><span className="management-workspace-label">RESTAURANT WORKSPACE</span></div><div className="management-restaurant-picker"><label htmlFor="management-restaurant">Workspace</label><select id="management-restaurant" value={restaurantId} onChange={(e) => changeRestaurant(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{selectedRestaurant?.branchIds === null && <label htmlFor="management-branch">Branch</label>}{selectedRestaurant?.branchIds === null && <select id="management-branch" value={branchId} onChange={(e) => changeBranch(e.target.value)}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}{selectedRestaurant?.branchIds && selectedRestaurant.branchIds.length > 1 && <><label htmlFor="management-branch">Assigned branch</label><select id="management-branch" value={branchId} onChange={(e) => changeBranch(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></>}</div><nav className="management-nav" aria-label="Management sections">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}{tab === item.id && <i/>}</button>)}</nav><div className="management-sidebar-bottom"><div className="staff-profile"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{selectedRestaurant?.role.replaceAll('_', ' ').toLowerCase()}</small></div></div><button className="management-logout" onClick={() => void logout()}>Sign out <span>↗</span></button></div></aside>
    <section className="management-main"><header className="management-topbar"><div><p className="customer-eyebrow">{selectedTitle} <span>·</span> Workspace</p><h1>{tabs.find((v) => v.id === tab)?.label}</h1></div><div className="management-top-actions">{canManageRestaurantContent && <a className="management-secondary" href="/analytics">Reports & analytics</a>}{isOwner && <button className="management-secondary" onClick={() => setCreatingRestaurant(true)}>＋ Add restaurant</button>}<button className="management-avatar" title={user.email}>{user.displayName.slice(0, 1).toUpperCase()}</button></div></header>{error && <p role="alert" className="management-alert">{error}<button onClick={() => setError('')}>×</button></p>}
      <div className="management-content" key={`${restaurantId}:${branchId}:${tab}`}>
        {tab === 'overview' && <OverviewPanel api={api} revision={revision} canManage={!!isManager} onNavigate={setTab}/>}
        {tab === 'restaurant' && <RestaurantPanel api={api} revision={revision} canWrite={canManageRestaurantContent}/>}
        {tab === 'branches' && <BranchesPanel api={api} revision={revision} canWrite={!!isOwner} onChanged={refresh}/>}
        {tab === 'staff' && <StaffPanel api={api} branches={availableBranches} revision={revision} canWrite={!!isOwner} onChanged={refresh}/>}
        {tab === 'tables' && <TablesPanel api={api} branches={availableBranches} revision={revision} canWrite={!!isManager} onChanged={refresh}/>}
        {tab === 'menu' && <MenuPanel api={api} branches={availableBranches} revision={revision} canWrite={canManageRestaurantContent} onChanged={refresh}/>}
      </div>
    </section>{creatingRestaurant && <RestaurantCreateDialog platformAdmin={user.isPlatformAdmin} error={error} submitting={creatingWorkspace} onClose={() => { setCreatingRestaurant(false); setError(''); }} onSubmit={createRestaurant}/>}
  </main>;
}

function WorkspaceErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="workspace-error-toast" role="alert" aria-live="assertive"><span aria-hidden="true">!</span><div><strong>Workspace could not be created</strong><p>{message}</p></div><button type="button" aria-label="Dismiss error message" onClick={onDismiss}>×</button></div>;
}

function OverviewPanel({ api, revision, canManage, onNavigate }: { api: TenantApi; revision: number; canManage: boolean; onNavigate: (tab: Tab) => void }) {
  const [summary, setSummary] = useState<{ branches: number; staff: number; tables: number; categories: number; items: number } | null>(null);
  useEffect(() => { let active = true; Promise.all([api<any>('/tenant/branches'), api<any>('/tenant/staff'), api<any>('/tenant/tables'), api<any>('/tenant/menu')]).then(([branches, staff, tables, menu]) => { if (active) setSummary({ branches: branches.length, staff: staff.length, tables: tables.length, categories: menu.length, items: menu.reduce((n: number, c: any) => n + c.items.length, 0) }); }).catch(() => { if (active) setSummary(null); }); return () => { active = false; }; }, [api, revision]);
  return <><div className="management-welcome"><div><span className="management-welcome-orbit">✳</span><p className="customer-eyebrow">A clear view of service</p><h2 className="display-type">Good to see you.</h2><p>Set up your restaurant, team, tables, and guest menu from one place.</p></div><div className="welcome-table-art"><span>✿</span><small>Hospitality, considered</small></div></div><div className="management-stat-grid">{[{ label: 'Branches', value: summary?.branches, tab: 'branches' as Tab, icon: '⌖' }, { label: 'Team members', value: summary?.staff, tab: 'staff' as Tab, icon: '♙' }, { label: 'Tables', value: summary?.tables, tab: 'tables' as Tab, icon: '▦' }, { label: 'Menu items', value: summary?.items, tab: 'menu' as Tab, icon: '❋' }].map((stat) => <button className="management-stat" key={stat.label} onClick={() => onNavigate(stat.tab)}><span>{stat.icon}</span><small>{stat.label}</small><strong>{stat.value ?? '—'}</strong><i>View {stat.label.toLowerCase()} →</i></button>)}</div><section className="management-card quickstart"><div><p className="customer-eyebrow">Next steps</p><h2>Make the table yours</h2><p>Add a branch, put a QR code on each table, and let guests order directly from the menu.</p></div><div className="quickstart-actions"><button onClick={() => onNavigate('tables')}>Set up tables <span>→</span></button><button onClick={() => onNavigate('menu')}>Manage menu <span>→</span></button></div></section>{!canManage && <p className="management-hint">This role has read-only management access. Ask a restaurant owner to make changes.</p>}</>;
}

function RestaurantCreateDialog({ platformAdmin, error, submitting, onClose, onSubmit }: { platformAdmin: boolean; error: string; submitting: boolean; onClose: () => void; onSubmit: (form: Record<string, string>) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '', logoUrl: '', coverImageUrl: '', contactPhone: '', websiteUrl: '', currency: 'ETB', timezone: 'Africa/Addis_Ababa', branchName: 'Main Branch', branchSlug: 'main', branchAddress: '', ownerEmail: '', ownerName: '', password: '' });
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  return <div className="management-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}><form className="management-modal workspace-create-modal" aria-busy={submitting} onSubmit={(e) => { e.preventDefault(); if (!submitting) void onSubmit(form); }}>
    <button className="management-modal-close" type="button" aria-label="Close create workspace form" disabled={submitting} onClick={onClose}>×</button>
    <div className="workspace-modal-heading"><span className="workspace-modal-mark" aria-hidden="true">✳</span><div><p className="customer-eyebrow">NEW WORKSPACE</p><h2 className="display-type">Set up a restaurant</h2><p>Create the restaurant profile and its first branch. You can configure tables, staff, and the menu afterward.</p></div></div>
    {error && <p className="management-alert workspace-modal-error" role="alert">{error}</p>}
    <div className="management-form-grid">
      <div className="workspace-form-section"><span>01</span><div><strong>Restaurant details</strong><small>How this restaurant appears in RestoIO.</small></div></div>
      <Field label="Restaurant name" value={form.name} onChange={(v) => { set('name', v); if (!form.slug) set('slug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/>
      <Field label="Workspace URL slug" value={form.slug} onChange={(v) => set('slug', v)} required hint="Lowercase letters, numbers, and hyphens"/>
      <Field label="Description" value={form.description} onChange={(v) => set('description', v)} wide/>
      <Field label="Currency code" value={form.currency} onChange={(v) => set('currency', v.toUpperCase())} required hint="For example, ETB"/>
      <Field label="Timezone" value={form.timezone} onChange={(v) => set('timezone', v)} required/>
      <div className="workspace-form-section"><span>02</span><div><strong>First branch</strong><small>Start with your main service location.</small></div></div>
      <Field label="Branch name" value={form.branchName} onChange={(v) => { set('branchName', v); if (!form.branchSlug || form.branchSlug === 'main') set('branchSlug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/>
      <Field label="Branch URL slug" value={form.branchSlug} onChange={(v) => set('branchSlug', v)} required/>
      <Field label="Branch address" value={form.branchAddress} onChange={(v) => set('branchAddress', v)} wide/>
      {platformAdmin && <>
        <div className="workspace-form-section"><span>03</span><div><strong>Restaurant owner</strong><small>Create the owner’s sign-in now.</small></div></div>
        <Field label="Owner name" value={form.ownerName} onChange={(v) => set('ownerName', v)} required/>
        <Field label="Owner email" type="email" value={form.ownerEmail} onChange={(v) => set('ownerEmail', v)} required/>
        <Field label="Temporary password" type="password" value={form.password} onChange={(v) => set('password', v)} required hint="At least 12 characters"/>
      </>}
    </div>
    <div className="management-modal-actions"><button type="button" className="management-secondary" disabled={submitting} onClick={onClose}>Cancel</button><button type="submit" className="management-primary" disabled={submitting}>{submitting ? <><span className="workspace-button-spinner" aria-hidden="true"/> Creating workspace…</> : 'Create workspace'}</button></div>
  </form></div>;
}

