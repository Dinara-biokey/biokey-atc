// ================================================================
//  biokey.ATC — Supabase Data Layer
//  Заполни SUPABASE_URL и SUPABASE_ANON_KEY из своего проекта:
//  https://supabase.com → Project Settings → API
// ================================================================

const SUPABASE_URL      = 'https://bhgiuyvgzanraiehqfns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZ2l1eXZnemFucmFpZWhxZm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzU3MDEsImV4cCI6MjA5OTYxMTcwMX0.eAXgBctblj-S1g7Pm3PAZTQ5Fsjf9p54QLLQUgy0wac';

// ── init ──────────────────────────────────────────────────────────
const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── helpers ───────────────────────────────────────────────────────
function _ok(res) {
  if (res.error) console.error('[db]', res.error.message);
  return res.data;
}

// ================================================================
window.db = {

  // ── CONFIG ────────────────────────────────────────────────────
  async loadConfig() {
    const res = await _sb.from('config').select('*').limit(1);
    return _ok(res)?.[0] || null;
  },

  async saveConfig(cfg) {
    const cur = await this.loadConfig();
    const payload = {
      server:      cfg.server      || '',
      domain:      cfg.domain      || '',
      sip_user:    cfg.user        || cfg.sip_user || '',
      sip_pass:    cfg.pass        || cfg.sip_pass || '',
      stun:        cfg.stun        || 'stun:stun.l.google.com:19302',
      reg_timeout: cfg.regTimeout  || cfg.reg_timeout || 300,
      preset:      cfg.preset      || 'custom',
      updated_at:  new Date().toISOString(),
    };
    if (cur?.id) {
      _ok(await _sb.from('config').update(payload).eq('id', cur.id));
    } else {
      _ok(await _sb.from('config').insert(payload));
    }
  },

  // Converts DB row → legacy format used by softphone
  configToLegacy(row) {
    if (!row) return null;
    return {
      server:     row.server,
      domain:     row.domain,
      user:       row.sip_user,
      pass:       row.sip_pass,
      stun:       row.stun,
      regTimeout: row.reg_timeout,
      preset:     row.preset,
    };
  },

  // ── OPERATORS ─────────────────────────────────────────────────
  async loadOperators() {
    const res = await _sb.from('operators').select('*').order('created_at', { ascending: true });
    return _ok(res) || [];
  },

  async saveOperator(op) {
    const payload = {
      name:   op.name,
      ext:    op.ext    || '',
      pass:   op.pass   || '',
      role:   op.role   || 'operator',
      status: op.status || 'active',
    };
    if (op.id) {
      const res = await _sb.from('operators').update(payload).eq('id', op.id).select().single();
      return _ok(res);
    } else {
      const res = await _sb.from('operators').insert(payload).select().single();
      return _ok(res);
    }
  },

  async deleteOperator(id) {
    _ok(await _sb.from('operators').delete().eq('id', id));
  },

  async setPresence(id, presence) {
    _ok(await _sb.from('operators').update({ presence }).eq('id', id));
  },

  subscribePresence(callback) {
    return _sb.channel('presence-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'operators' },
        payload => { if (payload.new) callback(payload.new); })
      .subscribe();
  },

  // ── CDR ───────────────────────────────────────────────────────
  async loadCDR(opts = {}) {
    let q = _sb.from('cdr').select('*').order('time', { ascending: false });
    if (opts.num)      q = q.ilike('num', `%${opts.num}%`);
    if (opts.type)     q = q.eq('type', opts.type);
    if (opts.op)       q = q.eq('op', opts.op);
    if (opts.dateFrom) q = q.gte('time', opts.dateFrom + 'T00:00:00');
    if (opts.dateTo)   q = q.lte('time', opts.dateTo   + 'T23:59:59');
    if (opts.limit)    q = q.limit(opts.limit);
    else               q = q.limit(500);
    return _ok(await q) || [];
  },

  async addCDR(entry) {
    _ok(await _sb.from('cdr').insert({
      num:  entry.num  || '',
      type: entry.type || 'miss',
      dur:  entry.dur  || 0,
      op:   entry.op   || '',
      time: entry.time || new Date().toISOString(),
    }));
  },

  async clearCDR() {
    _ok(await _sb.from('cdr').delete().gte('id', '00000000-0000-0000-0000-000000000000'));
  },

  // ── AUTH ──────────────────────────────────────────────────────
  async checkAdminLogin(login, pass) {
    if (!login || !pass) return false;
    // fetch by login only, compare pass in JS (avoids Supabase empty-string validation)
    const res = await _sb.from('admin_config').select('*').eq('login', login).limit(1);
    const rows = _ok(res) || [];
    return rows.length > 0 && rows[0].pass === pass;
  },

  async checkOperatorLogin(loginOrExt, pass) {
    if (!loginOrExt || !pass) return null;
    // try by ext first, then by name — compare pass in JS
    let res = await _sb.from('operators').select('*')
      .eq('status', 'active').eq('ext', loginOrExt).limit(1);
    let ops = _ok(res) || [];
    if (ops.length && ops[0].pass === pass) return ops[0];

    res = await _sb.from('operators').select('*')
      .eq('status', 'active').ilike('name', loginOrExt).limit(1);
    ops = _ok(res) || [];
    if (ops.length && ops[0].pass === pass) return ops[0];

    return null;
  },

  async setAdminCredentials(login, pass) {
    const res = await _sb.from('admin_config').select('id').limit(1);
    const rows = _ok(res) || [];
    if (rows.length) {
      _ok(await _sb.from('admin_config').update({ login, pass }).eq('id', rows[0].id));
    } else {
      _ok(await _sb.from('admin_config').insert({ login, pass }));
    }
  },

  // ── UTIL ──────────────────────────────────────────────────────
  isConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_URL.startsWith('https://');
  },

  showSetupBanner() {
    if (this.isConfigured()) return;
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9999;
      background:#f59e0b;color:#000;
      padding:10px 20px;font-size:13px;font-weight:600;text-align:center;
    `;
    div.innerHTML = '⚠️ Supabase не настроен. Открой <b>db.js</b> и вставь SUPABASE_URL и SUPABASE_ANON_KEY из своего проекта.';
    document.body.prepend(div);
  },
};

// Show banner if not configured
document.addEventListener('DOMContentLoaded', () => window.db.showSetupBanner());
