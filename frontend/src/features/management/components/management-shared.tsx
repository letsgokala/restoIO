'use client';
import { ApiClientError } from '../../../lib/api/client';

export function Field({ label, value, onChange, type = 'text', required = false, wide = false, hint = '', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; wide?: boolean; hint?: string; disabled?: boolean }) { return <label className={`management-field ${wide ? 'wide' : ''}`}><span>{label}</span><input type={type} value={value} required={required} disabled={disabled} onChange={(e) => onChange(e.target.value)}/>{hint && <small>{hint}</small>}</label>; }
export function PanelHeader({ kicker, title, copy, action }: { kicker: string; title: string; copy: string; action?: React.ReactNode }) { return <div className="management-panel-heading"><div><p className="customer-eyebrow">{kicker}</p><h2 className="display-type">{title}</h2><p>{copy}</p></div>{action}</div>; }
export function PanelError({ error }: { error: string }) { return error ? <p className="management-alert" role="alert">{error}</p> : null; }
export const managementError = (e: unknown) => e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Please try again.';
