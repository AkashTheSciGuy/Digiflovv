import { getStore } from '@netlify/blobs';
import backend from '../../scripts/hosted-device-api.cjs';
let api;
export default async function handler(request, context) {
  try {
    api ||= backend.hostedApiFromEnvironment({ ...process.env, DEPLOY_URL: context?.site?.id === "32b942bc-8f0a-433d-a526-eb863d82b44b" && /^[a-f0-9]{24}$/.test(context?.deploy?.id || "") ? `https://${context.deploy.id}--digiflovv.netlify.app` : undefined }, getStore({ name: 'digiflovv-command-state', consistency: 'strong' }), getStore({ name: 'digiflovv-device-links', consistency: 'strong' }));
    return await api(request);
  } catch (error) {
    console.error("Device service initialization failed", { category: error?.name === "MissingBlobsEnvironmentError" ? "storage-context" : "configuration", missing: ["DIGIFLOVV_LINK_ENCRYPTION_KEY", "DIGIFLOVV_SUPABASE_PUBLIC_KEY"].filter(key => !process.env[key]) });
    return new Response(JSON.stringify({ error: 'Device service unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
}
export const config = { path: '/api/*' };




