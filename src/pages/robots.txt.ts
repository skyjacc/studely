import type { APIRoute } from 'astro';
import { robotsTxt } from '@core/config/robots';

// See @core/config/robots for the body and why it is generated.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('http://localhost:4321');
  return new Response(robotsTxt(origin), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
