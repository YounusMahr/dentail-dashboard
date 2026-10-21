const DEFAULT_URL = 'http://145.241.106.128:8081';
const DEFAULT_API_KEY = 'hermes-evolution-key-2026';
const DEFAULT_INSTANCE = 'hremes';

export function getEvolutionConfig() {
  const baseUrl = (process.env.EVOLUTION_API_URL || DEFAULT_URL).replace(/\/+$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY || DEFAULT_API_KEY;
  const defaultInstance = process.env.EVOLUTION_DEFAULT_INSTANCE || DEFAULT_INSTANCE;
  return { baseUrl, apiKey, defaultInstance };
}

export function cleanPhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (/^03\d{9}$/.test(p)) p = '92' + p.slice(1);
  return p;
}

export async function evolutionFetch(path, options = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'apiKey': apiKey,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store'
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => '');
  }

  return { ok: res.ok, status: res.status, data };
}

export async function getLiveConnection(instanceName) {
  const { defaultInstance } = getEvolutionConfig();
  const target = instanceName || defaultInstance;

  try {
    const [stateRes, instancesRes] = await Promise.all([
      evolutionFetch(`/instance/connectionState/${encodeURIComponent(target)}`),
      evolutionFetch('/instance/fetchInstances')
    ]);

    let state = 'closed';
    if (stateRes.ok && stateRes.data?.instance?.state) {
      state = stateRes.data.instance.state;
    }

    let meta = null;
    if (instancesRes.ok && Array.isArray(instancesRes.data)) {
      meta = instancesRes.data.find(i => i.name === target || i.id === target) || null;
      if (!stateRes.ok && meta?.connectionStatus) {
        state = meta.connectionStatus;
      }
    }

    const isConnected = state === 'open';
    const ownerNumber = meta?.ownerJid ? meta.ownerJid.split('@')[0] : (meta?.number || '');

    return {
      connected: isConnected,
      state,
      instanceName: target,
      profileName: meta?.profileName || (isConnected ? 'WhatsApp Connected' : 'Disconnected'),
      profilePicUrl: meta?.profilePicUrl || null,
      ownerNumber,
      allInstances: Array.isArray(instancesRes.data) ? instancesRes.data.map(x => ({
        name: x.name,
        state: x.connectionStatus,
        owner: x.ownerJid?.split('@')[0] || ''
      })) : []
    };
  } catch (err) {
    return {
      connected: false,
      state: 'error',
      instanceName: target,
      error: err.message,
      allInstances: []
    };
  }
}

export async function createOrConnectInstance({ instanceName, qrcode = true, number = '' } = {}) {
  const { defaultInstance } = getEvolutionConfig();
  const target = (instanceName || defaultInstance).trim().replace(/\s+/g, '_');
  const normalizedNumber = number ? cleanPhone(number) : '';

  // 1. Try connect first
  const connectPath = `/instance/connect/${encodeURIComponent(target)}${normalizedNumber ? `?number=${normalizedNumber}` : ''}`;
  const connectAttempt = await evolutionFetch(connectPath);

  if (connectAttempt.ok && connectAttempt.data) {
    return {
      success: true,
      instanceName: target,
      base64: connectAttempt.data.base64 || null,
      code: connectAttempt.data.code || null,
      pairingCode: connectAttempt.data.pairingCode || null,
      state: connectAttempt.data.instance?.state || 'connecting'
    };
  }

  // 2. If not found or needed, create instance
  const createBody = {
    instanceName: target,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
    ...(normalizedNumber ? { number: normalizedNumber } : {})
  };

  const createAttempt = await evolutionFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify(createBody)
  });

  if (!createAttempt.ok) {
    throw new Error(createAttempt.data?.response?.message || createAttempt.data?.message || 'Failed to create instance');
  }

  return {
    success: true,
    instanceName: target,
    base64: createAttempt.data?.qrcode?.base64 || createAttempt.data?.base64 || null,
    code: createAttempt.data?.qrcode?.code || createAttempt.data?.code || null,
    pairingCode: createAttempt.data?.qrcode?.pairingCode || createAttempt.data?.pairingCode || null,
    state: createAttempt.data?.instance?.state || 'created'
  };
}

export async function disconnectInstance(instanceName) {
  const { defaultInstance } = getEvolutionConfig();
  const target = instanceName || defaultInstance;
  const res = await evolutionFetch(`/instance/logout/${encodeURIComponent(target)}`, {
    method: 'DELETE'
  });
  return { success: res.ok, data: res.data };
}

export async function sendEvolutionText(number, text, instanceName) {
  const { defaultInstance } = getEvolutionConfig();
  const target = instanceName || defaultInstance;
  const phone = cleanPhone(number);

  if (!phone || phone.length < 9) {
    throw new Error(`Invalid recipient phone: ${number}`);
  }

  const res = await evolutionFetch(`/message/sendText/${encodeURIComponent(target)}`, {
    method: 'POST',
    body: JSON.stringify({
      number: phone,
      text: String(text || '').trim()
    })
  });

  if (!res.ok) {
    const errMsg = res.data?.response?.message || res.data?.message || (typeof res.data === 'string' ? res.data : 'Failed to send message');
    throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
  }

  return {
    success: true,
    messageId: res.data?.key?.id || res.data?.messageId || null,
    status: res.data?.status || 'PENDING',
    raw: res.data
  };
}

export async function sendEvolutionMedia(number, { media, mediaType = 'image', caption = '', fileName = 'document.pdf' }, instanceName) {
  const { defaultInstance } = getEvolutionConfig();
  const target = instanceName || defaultInstance;
  const phone = cleanPhone(number);

  const res = await evolutionFetch(`/message/sendMedia/${encodeURIComponent(target)}`, {
    method: 'POST',
    body: JSON.stringify({
      number: phone,
      mediaType,
      media,
      caption,
      fileName
    })
  });

  if (!res.ok) {
    throw new Error(res.data?.response?.message || res.data?.message || 'Failed to send media');
  }

  return { success: true, data: res.data };
}
