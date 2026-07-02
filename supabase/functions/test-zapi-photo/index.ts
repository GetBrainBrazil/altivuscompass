Deno.serve(async () => {
  const inst = Deno.env.get('ZAPI_INSTANCE_ID');
  const tok = Deno.env.get('ZAPI_TOKEN');
  const ct = Deno.env.get('ZAPI_SECURITY_TOKEN');
  const headers: any = ct ? { 'Client-Token': ct } : {};
  const tests = [
    '6781937954913@lid',
    '6781937954913',
    '207941026214103@lid',
    '120363429660275719-group',
    '120363429660275719@g.us',
    '120363404533413681-group',
    '5521999055492',
    '5521964447436',
  ];
  const results: any = {};
  for (const p of tests) {
    const r1 = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/profile-picture?phone=${encodeURIComponent(p)}`, { headers });
    const j1 = await r1.json().catch(() => ({}));
    const r2 = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/chats/${encodeURIComponent(p)}`, { headers });
    const j2 = await r2.json().catch(() => ({}));
    const r3 = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/group-metadata/${encodeURIComponent(p)}`, { headers });
    const j3 = await r3.json().catch(() => ({}));
    results[p] = { picture: { status: r1.status, body: j1 }, chat: { status: r2.status, body: j2 }, group: { status: r3.status, body: j3 } };
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
