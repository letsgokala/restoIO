'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { registerRestaurant } from '../services/auth.service';

type Values = { restaurantName: string; slug: string; ownerName: string; ownerEmail: string; password: string; branchName: string };
const slugify = (value: string) => value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function RestaurantRegistrationForm() {
  const t = useTranslations('Auth');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const schema = z.object({
    restaurantName: z.string().trim().min(2, t('restaurantNameRequired')).max(120),
    slug: z.string().trim().toLowerCase().min(2, t('slugMin')).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('slugFormat')),
    ownerName: z.string().trim().min(2, t('nameRequired')).max(120),
    ownerEmail: z.string().trim().email(t('emailRequired')).max(254),
    password: z.string().min(12, t('passwordMin')).max(128),
    branchName: z.string().trim().min(2, t('branchRequired')).max(100),
  });
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { restaurantName: '', slug: '', ownerName: '', ownerEmail: '', password: '', branchName: t('mainBranch') },
  });
  const submit = handleSubmit(async (values) => {
    setError('');
    const branchSlug = slugify(values.branchName) || 'main-branch';
    try {
      await registerRestaurant({ name: values.restaurantName, slug: values.slug, ownerName: values.ownerName, ownerEmail: values.ownerEmail, password: values.password, branchName: values.branchName, branchSlug, currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
      setSubmitted(true);
    } catch {
      setError(t('registerFailed'));
    }
  });

  if (submitted) return <section className="register-confirmation" role="status"><h2>{t('requestSubmitted')}</h2><p>{t('requestSubmittedCopy')}</p><Link href="/login">{t('goToSignIn')}</Link></section>;

  return <form onSubmit={submit} className="login-form register-form">
    <label className="form-label" htmlFor="restaurant-name">{t('restaurantName')}
      <input id="restaurant-name" autoComplete="organization" className="form-input" aria-invalid={Boolean(errors.restaurantName)} {...register('restaurantName', { onChange: (event) => setValue('slug', slugify(event.target.value), { shouldValidate: true }) })}/>
      {errors.restaurantName && <span className="form-error">{errors.restaurantName.message}</span>}
    </label>
    <label className="form-label" htmlFor="restaurant-slug">{t('restaurantLink')}
      <input id="restaurant-slug" autoComplete="url" className="form-input" placeholder="blue-nile-cafe" {...register('slug')}/>
      <small>{t('restaurantLinkHint')}</small>
      {errors.slug && <span className="form-error">{errors.slug.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-name">{t('yourName')}
      <input id="owner-name" autoComplete="name" className="form-input" {...register('ownerName')}/>
      {errors.ownerName && <span className="form-error">{errors.ownerName.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-email">{t('email')}
      <input id="owner-email" autoComplete="email" type="email" className="form-input" {...register('ownerEmail')}/>
      {errors.ownerEmail && <span className="form-error">{errors.ownerEmail.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-password">{t('password')}
      <input id="owner-password" autoComplete="new-password" type="password" className="form-input" {...register('password')}/>
      {errors.password && <span className="form-error">{errors.password.message}</span>}
    </label>
    <label className="form-label" htmlFor="branch-name">{t('firstBranch')}
      <input id="branch-name" autoComplete="off" className="form-input" {...register('branchName')}/>
      {errors.branchName && <span className="form-error">{errors.branchName.message}</span>}
    </label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <Button className="button--full" disabled={isSubmitting}>{isSubmitting ? t('registerSubmitting') : t('registerSubmit')}<span aria-hidden="true">→</span></Button>
    <p className="login-footnote">{t('alreadyHaveAccount')} <Link href="/login">{t('submit')}</Link></p>
  </form>;
}
