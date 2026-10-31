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

export function ManagementApp() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null); const [restaurants, setRestaurants] = useState<ManagedRestaurant[]>([]); const [restaurantId, setRestaurantId] = useState(''); const [branchId, setBranchId] = useState(''); const [tab, setTab] = useState<Tab>('overview'); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0); const [creatingRestaurant, setCreatingRestaurant] = useState(false);
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
    setError('');
    try {
      const body = { name: form.name, slug: form.slug, description: form.description || undefined, logoUrl: form.logoUrl || undefined, coverImageUrl: form.coverImageUrl || undefined, contactPhone: form.contactPhone || undefined, websiteUrl: form.websiteUrl || undefined, currency: form.currency || 'ETB', timezone: form.timezone || 'Africa/Addis_Ababa', branchName: form.branchName, branchSlug: form.branchSlug, branchAddress: form.branchAddress || undefined };
      const result = user?.isPlatformAdmin ? await createRestaurantAsPlatformAdmin({ ...body, ownerEmail: form.ownerEmail, ownerName: form.ownerName, password: form.password }) : await createRestaurantAsOwner(body);
      const row = result as { restaurant: { id: string } }; sessionStorage.setItem('restoio-management-restaurant', row.restaurant.id);
      setCreatingRestaurant(false); await load(); setRestaurantId(row.restaurant.id); setBranchId('');
    } catch (e) { setError(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : 'Could not create the restaurant.'); }
  };
  const selectedTitle = useMemo(() => selectedRestaurant?.name ?? 'Restaurant workspace', [selectedRestaurant]);

  if (loading) return <main className="management-loading"><div className="customer-loader"/><p>Opening your workspace…</p></main>;
  if (!user) return <main className="management-gate"><Brand/><div className="management-gate-card"><span className="management-gate-icon">♙</span><p className="customer-eyebrow">Staff workspace</p><h1 className="display-type">{error || 'Sign in to manage your restaurant.'}</h1><a className="customer-primary" href="/login">Go to staff sign in</a></div></main>;
  if (!restaurants.length) return <main className="management-gate"><Brand/><div className="management-gate-card"><span className="management-gate-icon">✳</span><p className="customer-eyebrow">Welcome, {user.displayName}</p><h1 className="display-type">{user.isPlatformAdmin ? 'Create a restaurant workspace' : 'No restaurant is assigned to this account yet.'}</h1>{user.isPlatformAdmin && <button className="management-primary" onClick={() => setCreatingRestaurant(true)}>Create restaurant</button>}{error && <p role="alert" className="management-alert">{error}</p>}</div>{creatingRestaurant && <RestaurantCreateDialog platformAdmin={user.isPlatformAdmin} onClose={() => setCreatingRestaurant(false)} onSubmit={createRestaurant}/>}</main>;
  return <main className="management-shell">
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
    </section>{creatingRestaurant && <RestaurantCreateDialog platformAdmin={user.isPlatformAdmin} onClose={() => setCreatingRestaurant(false)} onSubmit={createRestaurant}/>}
  </main>;
}

function OverviewPanel({ api, revision, canManage, onNavigate }: { api: TenantApi; revision: number; canManage: boolean; onNavigate: (tab: Tab) => void }) {
  const [summary, setSummary] = useState<{ branches: number; staff: number; tables: number; categories: number; items: number } | null>(null);
  useEffect(() => { let active = true; Promise.all([api<any>('/tenant/branches'), api<any>('/tenant/staff'), api<any>('/tenant/tables'), api<any>('/tenant/menu')]).then(([branches, staff, tables, menu]) => { if (active) setSummary({ branches: branches.length, staff: staff.length, tables: tables.length, categories: menu.length, items: menu.reduce((n: number, c: any) => n + c.items.length, 0) }); }).catch(() => { if (active) setSummary(null); }); return () => { active = false; }; }, [api, revision]);
  return <><div className="management-welcome"><div><span className="management-welcome-orbit">✳</span><p className="customer-eyebrow">A clear view of service</p><h2 className="display-type">Good to see you.</h2><p>Set up your restaurant, team, tables, and guest menu from one place.</p></div><div className="welcome-table-art"><span>✿</span><small>Hospitality, considered</small></div></div><div className="management-stat-grid">{[{ label: 'Branches', value: summary?.branches, tab: 'branches' as Tab, icon: '⌖' }, { label: 'Team members', value: summary?.staff, tab: 'staff' as Tab, icon: '♙' }, { label: 'Tables', value: summary?.tables, tab: 'tables' as Tab, icon: '▦' }, { label: 'Menu items', value: summary?.items, tab: 'menu' as Tab, icon: '❋' }].map((stat) => <button className="management-stat" key={stat.label} onClick={() => onNavigate(stat.tab)}><span>{stat.icon}</span><small>{stat.label}</small><strong>{stat.value ?? '—'}</strong><i>View {stat.label.toLowerCase()} →</i></button>)}</div><section className="management-card quickstart"><div><p className="customer-eyebrow">Next steps</p><h2>Make the table yours</h2><p>Add a branch, put a QR code on each table, and let guests order directly from the menu.</p></div><div className="quickstart-actions"><button onClick={() => onNavigate('tables')}>Set up tables <span>→</span></button><button onClick={() => onNavigate('menu')}>Manage menu <span>→</span></button></div></section>{!canManage && <p className="management-hint">This role has read-only management access. Ask a restaurant owner to make changes.</p>}</>;
}

function RestaurantCreateDialog({ platformAdmin, onClose, onSubmit }: { platformAdmin: boolean; onClose: () => void; onSubmit: (form: Record<string, string>) => void }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '', logoUrl: '', coverImageUrl: '', contactPhone: '', websiteUrl: '', currency: 'ETB', timezone: 'Africa/Addis_Ababa', branchName: 'Main Branch', branchSlug: 'main', branchAddress: '', ownerEmail: '', ownerName: '', password: '' });
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  return <div className="management-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="management-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}><button className="management-modal-close" type="button" onClick={onClose}>×</button><p className="customer-eyebrow">New workspace</p><h2 className="display-type">Create a restaurant</h2><div className="management-form-grid"><Field label="Restaurant name" value={form.name} onChange={(v) => { set('name', v); if (!form.slug) set('slug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/><Field label="URL slug" value={form.slug} onChange={(v) => set('slug', v)} required/><Field label="Description" value={form.description} onChange={(v) => set('description', v)} wide/><Field label="Currency" value={form.currency} onChange={(v) => set('currency', v.toUpperCase())} required/><Field label="Timezone" value={form.timezone} onChange={(v) => set('timezone', v)} required/><Field label="First branch" value={form.branchName} onChange={(v) => { set('branchName', v); if (!form.branchSlug || form.branchSlug === 'main') set('branchSlug', v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required/><Field label="Branch slug" value={form.branchSlug} onChange={(v) => set('branchSlug', v)} required/><Field label="Branch address" value={form.branchAddress} onChange={(v) => set('branchAddress', v)} wide/>{platformAdmin && <><div className="management-form-divider">Restaurant owner account</div><Field label="Owner name" value={form.ownerName} onChange={(v) => set('ownerName', v)} required/><Field label="Owner email" type="email" value={form.ownerEmail} onChange={(v) => set('ownerEmail', v)} required/><Field label="Temporary password" type="password" value={form.password} onChange={(v) => set('password', v)} required hint="At least 12 characters"/></>}</div><div className="management-modal-actions"><button type="button" className="management-secondary" onClick={onClose}>Cancel</button><button type="submit" className="management-primary">Create workspace</button></div></form></div>;
}

