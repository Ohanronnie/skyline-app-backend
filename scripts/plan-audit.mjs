#!/usr/bin/env node
/**
 * Refreshes the <!-- AUTO:PLAN_AUDIT --> section in SKYINVENTORIES_BACKEND_PLAN.md
 * from static checks against the source tree. Run from repo root: npm run plan:audit
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const planPath = join(root, 'SKYINVENTORIES_BACKEND_PLAN.md');

function read(p) {
  return readFileSync(p, 'utf8');
}

function check(desc, ok, detail = '') {
  return { desc, ok, detail };
}

function has(str, re) {
  return re.test(str);
}

function runChecks() {
  const main = read(join(root, 'src/main.ts'));
  const appCtrl = read(join(root, 'src/app.controller.ts'));
  const partnersCtrl = read(join(root, 'src/partners/partners.controller.ts'));
  const payCtrl = read(join(root, 'src/payments/payments.controller.ts'));
  const payMod = read(join(root, 'src/payments/payments.module.ts'));
  const paySvc = read(join(root, 'src/payments/payments.service.ts'));
  const envTpl = existsSync(join(root, 'env.template'))
    ? read(join(root, 'env.template'))
    : '';

  const results = [
    check(
      'Global prefix `/api`',
      has(main, /setGlobalPrefix\s*\(\s*['"]\/api['"]\s*\)/),
    ),
    check(
      'GET /api/health (AppController @Get health)',
      has(appCtrl, /@Get\s*\(\s*['"]health['"]\s*\)/),
    ),
    check(
      'POST /api/partners/auth/refresh',
      has(partnersCtrl, /@Post\s*\(\s*['"]auth\/refresh['"]\s*\)/),
    ),
    check(
      'Payments: GET history (entitlements / portal)',
      has(payCtrl, /@Get\s*\(\s*['"]history['"]\s*\)/),
    ),
    check(
      'Payments: GET status (entitlements)',
      has(payCtrl, /@Get\s*\(\s*['"]status['"]\s*\)/),
    ),
    check(
      'Gateway gated: ENABLE_PAYMENTS_GATEWAY in payments.module factory',
      has(payMod, /ENABLE_PAYMENTS_GATEWAY/),
    ),
    check(
      'Gateway gated: optional HUBTEL_HTTP_CLIENT in PaymentsService',
      has(paySvc, /@Optional\s*\(\s*\)/) &&
        has(paySvc, /HUBTEL_HTTP_CLIENT/),
    ),
    check(
      'env.template documents ENABLE_PAYMENTS_GATEWAY',
      envTpl.length === 0 || has(envTpl, /ENABLE_PAYMENTS_GATEWAY/),
      envTpl.length === 0 ? 'env.template missing' : '',
    ),
  ];

  return results;
}

function formatAudit(results) {
  const ts = new Date().toISOString();
  const lines = [
    `**Generated:** ${ts} (\`npm run plan:audit\`)`,
    '',
    '| Check | Status |',
    '|-------|--------|',
  ];

  let failed = 0;
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAIL';
    if (!r.ok) failed++;
    const note = r.detail ? ` ${r.detail}` : '';
    lines.push(`| ${r.desc} | **${status}**${note} |`);
  }

  lines.push('');
  if (failed > 0) {
    lines.push(
      `**Summary:** ${failed} check(s) failed — fix code or template before relying on this audit.`,
    );
  } else {
    lines.push(
      '**Summary:** Core + payments gateway gating checks passed (verify DTOs and mobile `lib/api.ts` separately).',
    );
  }

  return lines.join('\n');
}

function inject(md, auditBody) {
  const start = '<!-- AUTO:PLAN_AUDIT -->';
  const end = '<!-- /AUTO:PLAN_AUDIT -->';
  const i0 = md.indexOf(start);
  const i1 = md.indexOf(end);
  if (i0 === -1 || i1 === -1 || i1 <= i0) {
    console.error(
      'Could not find AUTO:PLAN_AUDIT markers in SKYINVENTORIES_BACKEND_PLAN.md',
    );
    process.exit(1);
  }
  const before = md.slice(0, i0 + start.length);
  const after = md.slice(i1);
  return `${before}\n${auditBody}\n${after}`;
}

const results = runChecks();
const body = formatAudit(results);
const md = read(planPath);
writeFileSync(planPath, inject(md, body), 'utf8');
console.log(body);
console.log('\nUpdated SKYINVENTORIES_BACKEND_PLAN.md (AUTO:PLAN_AUDIT section).');

const failed = results.filter((r) => !r.ok).length;
process.exit(failed > 0 ? 1 : 0);
