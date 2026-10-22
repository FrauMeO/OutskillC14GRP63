import Privacy from './Privacy';

// The terms of use now live on the privacy page under "How we work" (Miah, 2026-10-22).
// /terms keeps working for old links and opens that page at the "How we work" section.
export { TERMS_UPDATED } from '../components/HowWeWork';

export default function Terms() {
  return <Privacy focus="how-we-work" />;
}
