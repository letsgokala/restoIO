'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { z } from 'zod';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/use-auth';
import { registerRestaurant } from '../services/auth.service';

const schema = z.object({
  restaurantName: z.string().trim().min(2, 'Enter the restaurant name').max(120),
  slug: z.string().trim().toLowerCase().min(2, 'Use at least 2 characters').max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
  ownerName: z.string().trim().min(2, 'Enter your name').max(120),
  ownerEmail: z.string().trim().email('Enter a valid email').max(254),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
  branchName: z.string().trim().min(2, 'Enter your first branch name').max(100),
});
type Values = z.infer<typeof schema>;
const slugify = (value: string) => value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function RestaurantRegistrationForm() {
  const auth = useAuth();
  const [error, setError] = useState('');
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { restaurantName: '', slug: '', ownerName: '', ownerEmail: '', password: '', branchName: 'Main Branch' },
  });
  const submit = handleSubmit(async (values) => {
    setError('');
    const branchSlug = slugify(values.branchName) || 'main-branch';
    try {
      await registerRestaurant({ name: values.restaurantName, slug: values.slug, ownerName: values.ownerName, ownerEmail: values.ownerEmail, password: values.password, branchName: values.branchName, branchSlug, currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
      const result = await auth.signIn(values.ownerEmail, values.password);
      if (result) window.location.assign('/manage');
      else setError('Your restaurant is ready, but automatic sign-in failed. Please sign in with the email and password you created.');
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'We could not create the restaurant account. Please try again.');
    }
  });

  return <form onSubmit={submit} className="login-form register-form">
    <label className="form-label" htmlFor="restaurant-name">Restaurant name
      <input id="restaurant-name" autoComplete="organization" className="form-input" aria-invalid={Boolean(errors.restaurantName)} {...register('restaurantName', { onChange: (event) => setValue('slug', slugify(event.target.value), { shouldValidate: true }) })}/>
      {errors.restaurantName && <span className="form-error">{errors.restaurantName.message}</span>}
    </label>
    <label className="form-label" htmlFor="restaurant-slug">Restaurant link
      <input id="restaurant-slug" autoComplete="url" className="form-input" placeholder="blue-nile-cafe" {...register('slug')}/>
      <small>Used to identify your restaurant workspace.</small>
      {errors.slug && <span className="form-error">{errors.slug.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-name">Your name
      <input id="owner-name" autoComplete="name" className="form-input" {...register('ownerName')}/>
      {errors.ownerName && <span className="form-error">{errors.ownerName.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-email">Email
      <input id="owner-email" autoComplete="email" type="email" className="form-input" {...register('ownerEmail')}/>
      {errors.ownerEmail && <span className="form-error">{errors.ownerEmail.message}</span>}
    </label>
    <label className="form-label" htmlFor="owner-password">Password
      <input id="owner-password" autoComplete="new-password" type="password" className="form-input" {...register('password')}/>
      {errors.password && <span className="form-error">{errors.password.message}</span>}
    </label>
    <label className="form-label" htmlFor="branch-name">First branch
      <input id="branch-name" autoComplete="off" className="form-input" {...register('branchName')}/>
      {errors.branchName && <span className="form-error">{errors.branchName.message}</span>}
    </label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <Button className="button--full" disabled={isSubmitting || auth.loading}>{isSubmitting || auth.loading ? 'Creating workspace…' : 'Create restaurant account'}<span aria-hidden="true">→</span></Button>
    <p className="login-footnote">Already have an account? <Link href="/login">Sign in</Link></p>
  </form>;
}
