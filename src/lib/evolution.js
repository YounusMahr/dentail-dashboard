const DEFAULT_INSTANCE = 'hremes';

export function getEvolutionConfig() {
  const baseUrl = (process.env.EVOLUTION_API_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  const apiKey = (process.env.EVOLUTION_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  const defaultInstance = (process.env.EVOLUTION_DEFAULT_INSTANCE || DEFAULT_INSTANCE).trim().replace(/^["']|["']$/g, '');
  return { baseUrl, apiKey, defaultInstance, configured:/^https?:\/\/[^\s]+$/i.test(baseUrl)&&Boolean(apiKey)&&!apiKey.includes('...') };
}

export function cleanPhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (/^03\d{9}$/.test(p)) p = '92' + p.slice(1);
  return p;
}

export async function evolutionFetch(path, options = {}) {
  const { baseUrl, apiKey, configured } = getEvolutionConfig();
  if(!configured)return {ok:false,status:503,data:{message:'WhatsApp provider is not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the server.'}};
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'apikey': apiKey,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => '');
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 503, data: { message: err.message }, error: err.message };
  }
}

export async function getLiveConnection(instanceName) {
  const { defaultInstance,configured } = getEvolutionConfig();
  const target = instanceName || defaultInstance;
  if(!configured)return {connected:false,state:'unconfigured',instanceName:target,error:'WhatsApp provider is not configured on this server.',allInstances:[]};

  try {
    const [stateRes, instancesRes] = await Promise.all([
      evolutionFetch(`/instance/connectionState/${encodeURIComponent(target)}`),
      evolutionFetch('/instance/fetchInstances')
    ]);
    if([401,403].includes(stateRes.status)||[401,403].includes(instancesRes.status))return {connected:false,state:'unauthorized',instanceName:target,error:'WhatsApp provider rejected the server API key. Use the global Evolution API key in Production settings.',allInstances:[]};
    if([stateRes,instancesRes].some(result=>!result.ok&&result.status>=500))return {connected:false,state:'unavailable',instanceName:target,error:'WhatsApp provider is unavailable. Try again shortly.',allInstances:[]};

    let state = 'closed';
    if (stateRes.ok && stateRes.data?.instance?.state) {
      state = stateRes.data.instance.state;
    }

    let meta = null;
    if (instancesRes.ok && Array.isArray(instancesRes.data)) {
      meta = instancesRes.data.find(i => i.name === target || i.id === target) || null;
      if (meta?.connectionStatus) {
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

export async function createOrConnectInstance({ instanceName, number = '' } = {}) {
  const { defaultInstance } = getEvolutionConfig();
  const target = (instanceName || defaultInstance).trim().replace(/\s+/g, '_');
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(target))throw new Error('Instance name must use letters, numbers, hyphens or underscores.');
  const normalizedNumber = number ? cleanPhone(number) : '';

  // 1. Check if target is already connected and open
  const live = await getLiveConnection(target);
  if(live.state==='unconfigured'||live.state==='unauthorized'||live.state==='unavailable')throw new Error(live.error);
  if (live.connected) {
    return {
      success: true,
      instanceName: target,
      base64: null,
      code: null,
      pairingCode: null,
      state: 'open',
      alreadyConnected: true,
      profileName: live.profileName,
      ownerNumber: live.ownerNumber
    };
  }

  // 2. Try connect first
  const connectPath = `/instance/connect/${encodeURIComponent(target)}${normalizedNumber ? `?number=${normalizedNumber}` : ''}`;
  const connectAttempt = await evolutionFetch(connectPath);
  if([401,403].includes(connectAttempt.status))throw new Error('WhatsApp provider rejected the server API key. Set EVOLUTION_API_KEY to the global Evolution API key in Production and redeploy.');

  if (connectAttempt.ok && connectAttempt.data) {
    const isStateOpen = connectAttempt.data.instance?.state === 'open';
    return {
      success: true,
      instanceName: target,
      base64: connectAttempt.data.qrcode?.base64 || connectAttempt.data.base64 || null,
      code: connectAttempt.data.qrcode?.code || connectAttempt.data.code || null,
      pairingCode: connectAttempt.data.qrcode?.pairingCode || connectAttempt.data.pairingCode || null,
      state: connectAttempt.data.instance?.state || (isStateOpen ? 'open' : 'connecting'),
      alreadyConnected: isStateOpen
    };
  }

  // 3. If instance doesn't exist yet, create it
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
  if([401,403].includes(createAttempt.status))throw new Error('WhatsApp provider rejected the server API key. Check that EVOLUTION_API_KEY is the global key in Production.');

  if (!createAttempt.ok) {
    const rawMsg = createAttempt.data?.response?.message || createAttempt.data?.message || '';
    const errMsg = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg || 'Failed to create instance');

    // If instance is already created, try connecting again to get its QR or state
    if (errMsg.toLowerCase().includes('already in use') || errMsg.toLowerCase().includes('already exists')) {
      const retryConnect = await evolutionFetch(connectPath);
      if([401,403].includes(retryConnect.status))throw new Error('WhatsApp provider rejected the server API key. Check that EVOLUTION_API_KEY is the global key in Production.');
      if (retryConnect.ok && retryConnect.data) {
        return {
          success: true,
          instanceName: target,
          base64: retryConnect.data.qrcode?.base64 || retryConnect.data.base64 || null,
          code: retryConnect.data.qrcode?.code || retryConnect.data.code || null,
          pairingCode: retryConnect.data.qrcode?.pairingCode || retryConnect.data.pairingCode || null,
          state: retryConnect.data.instance?.state || 'connecting',
          alreadyConnected: retryConnect.data.instance?.state === 'open'
        };
      }
    }
    throw new Error(errMsg);
  }

  return {
    success: true,
    instanceName: target,
    base64: createAttempt.data?.qrcode?.base64 || createAttempt.data?.base64 || null,
    code: createAttempt.data?.qrcode?.code || createAttempt.data?.code || null,
    pairingCode: createAttempt.data?.qrcode?.pairingCode || createAttempt.data?.pairingCode || null,
    state: createAttempt.data?.instance?.state || 'created',
    alreadyConnected: false
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

export async function sendEvolutionMedia(number, { media, mediaType = 'document', mimeType = 'application/pdf', caption = '', fileName = 'document.pdf' }, instanceName) {
  const { defaultInstance } = getEvolutionConfig();
  const target = instanceName || defaultInstance;
  const phone = cleanPhone(number);
  if (!phone || phone.length < 9) throw new Error('Invalid recipient phone');

  const res = await evolutionFetch(`/message/sendMedia/${encodeURIComponent(target)}`, {
    method: 'POST',
    body: JSON.stringify({
      number: phone,
      mediatype: mediaType,
      mimetype: mimeType,
      media,
      caption,
      fileName
    })
  });

  if (!res.ok) {
    const message = res.data?.response?.message || res.data?.message || 'Failed to send media';
    throw new Error(typeof message === 'object' ? JSON.stringify(message) : String(message));
  }

  return { success: true, messageId: res.data?.key?.id || res.data?.messageId || null, data: res.data };
}
