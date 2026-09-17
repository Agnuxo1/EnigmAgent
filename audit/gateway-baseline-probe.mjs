import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
const root = resolve(process.argv[2] || '.');
const { VaultManager, FileStorage } = await import(pathToFileURL(join(root, 'platforms/mcp-server/vault-core.js')));
const dir = await mkdtemp(join(tmpdir(), 'enigmagent-probe-'));
const fixture = 'SYNTHETIC_AUDIT_VALUE_NOT_A_CREDENTIAL';
const file = join(dir, 'test.vault.json');
const vault = new VaultManager(new FileStorage(file));
const children = [];
const results = { source_commit: '21e26997219ecb2f3d27a492b4802d1b97a4f13d', synthetic_data_only: true };
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: dir, TMP: dir, HOME: dir, USERPROFILE: dir, ENIGMAGENT_USER: 'audit-user', ENIGMAGENT_PASS: 'synthetic-test-password-only', ENIGMAGENT_VAULT: file };
const delay = ms => new Promise(r => setTimeout(r, ms));
async function launch(mode, port) {
  const child = spawn(process.execPath, [join(root,'platforms/mcp-server/index.js'), '--mode', mode, '--port', String(port)], { env, stdio: ['pipe','pipe','pipe'] });
  children.push(child);
  const state = { out: '', err: '', child };
  child.stdout.on('data', b => state.out += b.toString());
  child.stderr.on('data', b => state.err += b.toString());
  for (let i=0; i<400 && !state.err.includes('Listening'); i++) {
    if (child.exitCode !== null) throw new Error('Fixture server exited before readiness');
    await delay(50);
  }
  if (!state.err.includes('Listening')) throw new Error('Fixture server startup timed out');
  return state;
}
async function call(port, method, path, headers = {}, body = '') {
  return new Promise((res, rej) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers, agent: false }, r => {
      let data=''; r.on('data', b => data += b); r.on('end', () => res({status:r.statusCode, data}));
    });
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.on('error', rej); req.end(body);
  });
}
try {
  await vault.create(env.ENIGMAGENT_USER, env.ENIGMAGENT_PASS);
  await vault.addSecret({name:'AUDIT_TOKEN',domain:'example.com',value:fixture}); vault.lock();
  const reservation=createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(r=>reservation.close(r));
  await launch('rest',port);
  const body=JSON.stringify({placeholder:'AUDIT_TOKEN',origin:'https://example.com'});
  const headers={'Content-Type':'application/json'};
  results.unauthenticated_list_status=(await call(port,'GET','/list')).status;
  const raw=await call(port,'POST','/resolve',headers,body);
  results.unauthenticated_resolve_status=raw.status;
  results.unauthenticated_resolve_disclosed_fixture=raw.data.includes(fixture);
  results.untrusted_host_status=(await call(port,'POST','/resolve',{...headers,Host:'attacker.invalid'},body)).status;
  results.untrusted_browser_origin_status=(await call(port,'POST','/resolve',{...headers,Origin:'https://attacker.invalid'},body)).status;
  const mcp=await launch('mcp',port);
  mcp.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'enigmagent_resolve',arguments:{placeholder:'AUDIT_TOKEN',origin:'https://example.com'}}})+'\n');
  for(let i=0;i<80&&!mcp.out.includes('"id":1');i++) await delay(25);
  results.default_mcp_disclosed_fixture=mcp.out.includes(fixture);
  mcp.child.stdin.write('null\n');
  for(let i=0;i<80&&mcp.child.exitCode===null;i++) await delay(25);
  results.mcp_null_input_exited=mcp.child.exitCode!==null;
  await writeFile(join(root,'audit','gateway-baseline-2026-09-17.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally {
  for(const child of children) {
    if(child.exitCode===null) { const done=once(child,'exit'); child.kill(); await done; }
  }
  await rm(dir,{recursive:true,force:true});
}
