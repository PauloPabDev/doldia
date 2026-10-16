import type { Metadata } from 'next';
import { Onboarding } from './onboarding';

export const metadata: Metadata = { title: 'Bienvenida' };

export default function OnboardingPage() {
  return <Onboarding />;
}
