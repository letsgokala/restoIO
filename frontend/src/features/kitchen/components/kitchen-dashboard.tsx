'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { localizeDefaultBranchName } from '../../../lib/i18n/labels';
import { Brand } from '../../../components/shared/brand';
import { ApiClientError, apiRequest } from '../../../lib/api/client';
import type { ManagedRestaurant } from '../../management/management.service';
import { accessibleKitchenRestaurants, type KitchenApi, type KitchenOrder, type KitchenQueue } from '../kitchen.service';

type Lane = 'queued' | 'preparing' | 'ready';
const KITCHEN_OVERDUE_MINUTES = 15;
const ageLabel = (date: string, now: number, locale: string) => {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return seconds < 60 ? formatter.format(-seconds, 'second') : seconds < 3600 ? formatter.format(-Math.floor(seconds / 60), 'minute') : formatter.format(-Math.floor(seconds / 3600), 'hour');
};

export function KitchenDashboard() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('App');
  const [restaurants, setRestaurants] = useState<ManagedRestaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [identity, setIdentity] = useState<{ displayName: string } | null>(null);
  const [queue, setQueue] = useState<KitchenQueue | null>(null);
  const [lane, setLane] = useState<Lane>('queued');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [updated, setUpdated] = useState('');
  const [now, setNow] = useState(Date.now());
  const [fullScreen, setFullScreen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === restaurantId);
  const branches = selectedRestaurant?.branches.filter((branch) => branch.isActive || branch.id === branchId) ?? [];
  const api: KitchenApi = useCallback((path, init = {}) => {
    if (!restaurantId) return Promise.reject(new Error(t('chooseRestaurantFirst')));
    const headers = new Headers(init.headers);
    headers.set('X-Restaurant-Id', restaurantId);
    if (branchId) headers.set('X-Branch-Id', branchId); else headers.delete('X-Branch-Id');
    return apiRequest(path, { ...init, headers });
  }, [branchId, restaurantId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [me, access] = await Promise.all([
          apiRequest<{ user: { displayName: string } }>('/auth/me'),
          accessibleKitchenRestaurants(),
        ]);
        if (!active) return;
        setIdentity(me.user);
        const kitchenRestaurants = access.restaurants.filter((restaurant) => restaurant.role === 'KITCHEN');
        setRestaurants(kitchenRestaurants);
        const restaurant = kitchenRestaurants[0];
        if (restaurant) {
          setRestaurantId(restaurant.id);
          const branch = restaurant.branchIds?.[0] ?? restaurant.branches[0]?.id ?? '';
          setBranchId(branch);
        }
      } catch (cause) {
        if (active) setError(cause instanceof ApiClientError && cause.status === 401 ? t('staffSessionExpired') : t('couldNotOpenKitchen'));
      }
    })();
    return () => { active = false; };
  }, [t]);

  const refresh = useCallback(async () => {
    if (!restaurantId || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await api<KitchenQueue>('/tenant/kitchen/queue');
      setQueue(next);
      setUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setNow(Date.now());
      setError('');
    } catch (cause) {
      setError(t('couldNotRefreshQueue'));
    } finally {
      inFlight.current = false;
    }
  }, [api, restaurantId, t]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let generation = 0;
    const poll = async () => { const current = generation; await refresh(); if (active && current === generation) timer = setTimeout(poll, document.visibilityState === 'visible' ? 5000 : 30000); };
    void poll();
    const wake = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); generation += 1; void poll(); } };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearTimeout(timer); clearInterval(clock); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [refresh]);

  const mutate = async (reference: string, path: string) => {
    setBusy(reference); setError('');
    try { const updatedOrder = await api<KitchenOrder>(path, { method: 'PATCH' }); if (updatedOrder.status === 'PREPARING') setLane('preparing'); if (updatedOrder.status === 'READY') setLane('ready'); await refresh(); }
    catch (cause) { setError(t('couldNotUpdateTicket')); }
    finally { setBusy(''); }
  };
  const orders = useMemo(() => queue?.orders ?? [], [queue]);
  const assignedRestaurant = selectedRestaurant;

  if (!identity && !error) return <main className="kitchen-gate"><div className="customer-loader"/><p>{t('openingKitchen')}…</p></main>;
  if (!identity) return <main className="kitchen-gate"><Brand/><section><p className="customer-eyebrow">RestoIO · {t('kitchen')}</p><h1>{t('signInKitchen')}</h1><p>{error}</p><a href="/login" className="kitchen-action">{t('staffSignIn')}</a></section></main>;
  if (!restaurants.length) return <main className="kitchen-gate"><Brand/><section><p className="customer-eyebrow">{t('kitchenAccess')}</p><h1>{t('kitchenNoAssignment')}</h1><p>{t('assignKitchen')}</p><button className="kitchen-action" onClick={() => void apiRequest('/auth/logout', { method: 'POST' }).finally(() => router.push('/login'))}>{t('signOut')}</button></section></main>;

  const laneOrders = (status: Lane) => orders.filter((order) => (status === 'queued' ? order.status === 'CONFIRMED' : status === 'preparing' ? order.status === 'PREPARING' : order.status === 'READY') && (!search || `${order.reference} ${order.table.label} ${order.items.map((item) => item.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const labels: Record<Lane, string> = { queued: t('newTickets'), preparing: t('inPreparation'), ready: t('readyPickup') };
  const totals = { queued: laneOrders('queued').length, preparing: laneOrders('preparing').length, ready: laneOrders('ready').length };

  return <main ref={root} className="kitchen-shell">
    <header className="kitchen-topbar"><div className="kitchen-brand"><Brand/><span>{t('backOfHouse')}</span></div><div className="kitchen-location"><strong>{assignedRestaurant?.name}</strong><span>{localizeDefaultBranchName(branches.find((branch) => branch.id === branchId)?.name ?? t('assignedBranch'), t('mainBranch'))}</span>{branches.length > 1 && <select aria-label={t('branch')} value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{localizeDefaultBranchName(branch.name, t('mainBranch'))}</option>)}</select>}</div><div className="kitchen-top-actions"><span className={`kitchen-live ${error ? 'offline' : ''}`}><i/>{error ? t('connectionIssue') : queue ? t('liveQueue') : t('connecting')}</span><span className="kitchen-updated">{t('updated')} {updated || '—'}</span><button className="kitchen-icon-button" aria-label={t('refreshTickets')} onClick={() => void refresh()}>↻</button><button className="kitchen-icon-button" aria-label={fullScreen ? t('exitFullscreen') : t('enterFullscreen')} onClick={async () => { if (!document.fullscreenElement) { await root.current?.requestFullscreen(); setFullScreen(true); } else { await document.exitFullscreen(); setFullScreen(false); } }}>⛶</button></div></header>
    {error && <div className="kitchen-alert" role="alert">{error}<button aria-label={t('dismissError')} onClick={() => setError('')}>×</button></div>}
    <div className="kitchen-summary"><div><p className="customer-eyebrow">{assignedRestaurant?.name} · {localizeDefaultBranchName(branches.find((branch) => branch.id === branchId)?.name ?? '', t('mainBranch'))}</p><h1>{t('kitchenDisplay')}</h1></div><div className="kitchen-counts">{(['queued', 'preparing', 'ready'] as const).map((item) => <button key={item} className={lane === item ? 'selected' : ''} onClick={() => setLane(item)}><small>{labels[item]}</small><strong>{totals[item]}</strong></button>)}</div></div>
    <nav className="kitchen-lanes" aria-label={t('kitchen')}>{(['queued', 'preparing', 'ready'] as const).map((item) => <button key={item} className={lane === item ? 'active' : ''} onClick={() => setLane(item)}>{labels[item]} <b>{totals[item]}</b></button>)}</nav>
    <label className="kitchen-search"><span>⌕</span><input aria-label={t('searchTickets')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchTicketsPlaceholder')}/></label>
    {queue?.changes.length ? <aside className="kitchen-change-feed" aria-live="polite"><strong>{t('recentTicketChanges')}</strong>{queue.changes.map((change) => <p key={`${change.reference}-${change.changedAt}`}>{t('table')} {change.table.label} · {t('orderCaps')} {change.reference.slice(-6)} {t('cancelled')} · {change.note}</p>)}</aside> : null}
    <section className="kitchen-ticket-grid" aria-live="polite">{laneOrders(lane).map((order) => <Ticket key={order.reference} order={order} now={now} busy={busy === order.reference} onStart={() => void mutate(order.reference, `/tenant/kitchen/orders/${order.reference}/start`)} onItemReady={(itemId) => void mutate(order.reference, `/tenant/kitchen/orders/${order.reference}/items/${itemId}/ready`)} onAllReady={() => void mutate(order.reference, `/tenant/kitchen/orders/${order.reference}/ready-remaining`)}/>)}{!laneOrders(lane).length && <div className="kitchen-empty"><span>✓</span><h2>{queue ? t('allClear') : `${t('loadingTickets')}…`}</h2><p>{queue ? t('noTicketsQueue') : t('confirmedOrdersAppear')}</p></div>}</section>
    <footer className="kitchen-footer"><span>{t('signedInAs')} {identity.displayName}</span><span>{t('refreshesEveryFiveSeconds')}</span><button onClick={async () => { await apiRequest('/auth/logout', { method: 'POST' }); router.push('/login'); }}>{t('signOut')}</button></footer>
  </main>;
}

function Ticket({ order, now, busy, onStart, onItemReady, onAllReady }: { order: KitchenOrder; now: number; busy: boolean; onStart: () => void; onItemReady: (id: string) => void; onAllReady: () => void }) {
  const t = useTranslations('App');
  const locale = useLocale();
  const since = order.status === 'CONFIRMED' ? order.createdAt : order.items.find((item) => item.preparationStartedAt)?.preparationStartedAt ?? order.updatedAt;
  const minutes = Math.floor((now - new Date(since).getTime()) / 60_000);
  const overdue = minutes >= KITCHEN_OVERDUE_MINUTES && order.status !== 'READY';
  const readyCount = order.items.filter((item) => item.status === 'READY').length;
  return <article className={`kitchen-ticket ${order.status.toLowerCase()} ${overdue ? 'overdue' : ''}`}>
    <header className="kitchen-ticket-head"><div><span className="kitchen-ticket-state">{order.status === 'CONFIRMED' ? t('newTicket') : order.status === 'PREPARING' ? t('preparingCaps') : t('readyCaps')}</span><small>{order.branch.name}</small></div><div className="kitchen-ticket-age" title={new Date(order.createdAt).toLocaleString(locale)}><strong>{ageLabel(since, now, locale)}</strong><small>{overdue ? t('waitingTooLong') : order.status === 'CONFIRMED' ? t('inQueue') : t('inKitchenStatus')}</small></div></header>
    <div className="kitchen-ticket-title"><div><span>{t('tableCaps')}</span><strong>{order.table.label}</strong></div><div><span>{t('orderCaps')}</span><strong>{order.reference.slice(-6)}</strong></div></div>
    <div className="kitchen-ticket-items">{order.items.map((item) => <article className={`kitchen-item ${item.status.toLowerCase()}`} key={item.id}><span className="kitchen-item-quantity">{item.quantity}<small>×</small></span><div className="kitchen-item-copy"><strong>{item.name}</strong>{Array.isArray(item.customizations) && item.customizations.length > 0 && <p className="kitchen-modifiers">{item.customizations.map((customization, index) => [customization.group, customization.option].filter(Boolean).join(': ')).join(' · ')}</p>}{item.specialInstructions && <p className="kitchen-instruction"><span>{t('prepNoteCaps')}</span>{item.specialInstructions}</p>}</div>{item.status === 'READY' ? <span className="kitchen-ready-mark">✓ {t('ready')}</span> : order.status === 'PREPARING' && <button className="kitchen-item-ready" disabled={busy} onClick={() => onItemReady(item.id)}>{t('markReady')}</button>}</article>)}</div>
    <footer className="kitchen-ticket-footer">{order.status === 'CONFIRMED' ? <button className="kitchen-action start" disabled={busy} onClick={onStart}>{busy ? t('starting') : t('startPreparation')}</button> : order.status === 'PREPARING' ? <><span>{readyCount}/{order.items.length} {t('itemsReady')}</span>{readyCount < order.items.length && <button className="kitchen-action ready-all" disabled={busy} onClick={onAllReady}>{busy ? t('updating') : t('markRemainingReady')}</button>}</> : <span className="kitchen-ready-call">✓ {t('completeWaitingService')}</span>}</footer>
  </article>;
}
