// Behavioral tests for the calculator's inline script, run against a stubbed
// DOM in JavaScriptCore (no Node or browser needed):
//
//   cd <repo root> && osascript -l JavaScript tests/run-tests.js
//
ObjC.import('Foundation');

const cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
const htmlPath = cwd + '/index.html';
const src = $.NSString.stringWithContentsOfFileEncodingError(htmlPath, $.NSUTF8StringEncoding, null);
if (!src) throw new Error('Cannot read ' + htmlPath + ' — run from the repo root.');
const script = src.js.split('<script>')[1].split('</scr' + 'ipt>')[0];

// --- minimal DOM/browser stubs ---
const elements = {};
function makeEl(id) {
  return {
    id: id, value: '', checked: false, min: '', max: '',
    textContent: '', className: '', disabled: false, innerHTML: '',
    addEventListener: function(){},
    classList: { add: function(){}, remove: function(){}, contains: function(){ return false; } },
    dataset: {}, getContext: function(){ return {}; }
  };
}
const documentStub = {
  getElementById: function(id){ if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  querySelectorAll: function(){ return []; },
  querySelector: function(){ return makeEl('_q'); },
  createElement: function(){ return makeEl('_new'); }
};
const store = {};
const localStorageStub = {
  getItem: function(k){ return store[k] !== undefined ? store[k] : null; },
  setItem: function(k, v){ store[k] = String(v); }
};
const locationStub = { search: '', href: 'file:///index.html' };
function URLSearchParamsStub(){
  this.keys = function(){ return [][Symbol.iterator](); };
  this.forEach = function(){}; this.set = function(){}; this.toString = function(){ return ''; };
}

// HTML default input values
const defaults = {
  purchase: '600000', value: '750000', mortgage: '400000', interest: '6.5',
  term: '25', rent: '550', growth: '4', rentgrowth: '3', costinfl: '2',
  rates: '2500', insurance: '1500', maintenance: '2000', bodycorp: '0',
  mgmt: '8', vacancy: '2', taxrate: '33', deductible: '100',
  agent: '3', marketing: '1500', legal: '1500',
  altReturn: '8', altTax: '28', years: '15', sellyear: '0', inflation: '2'
};
for (const k in defaults) documentStub.getElementById(k).value = defaults[k];
const attrs = { deductible: ['0','100'], years: ['1','40'], sellyear: ['0','40'], inflation: ['0','10'] };
for (const k in attrs) { elements[k].min = attrs[k][0]; elements[k].max = attrs[k][1]; }

const sandbox = new Function('document', 'localStorage', 'location', 'URLSearchParams', 'window', 'navigator',
  script + '\n; return { recalc: recalc, fmt: fmt, compute: compute, parseParams: parseParams, ' +
  'collectState: collectState, saveScenario: saveScenario, getScenarios: getScenarios };');
const api = sandbox(documentStub, localStorageStub, locationStub, URLSearchParamsStub, { prompt: function(){} }, {});

// --- assertion helpers ---
let pass = 0, fail = 0;
const out = [];
function check(name, cond, detail) {
  if (cond) { pass++; out.push('PASS  ' + name); }
  else { fail++; out.push('FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function get(id){ return elements[id].textContent; }
function money(text){ return parseFloat(String(text).replace(/[^0-9.\-]/g, '')); }
function cell(rowIdx, colIdx){
  const rows = elements['tableBody'].innerHTML.split('</tr>');
  return rows[rowIdx].replace(/<tr[^>]*>/, '').split('</td>').map(c => c.replace(/<td[^>]*>/, ''))[colIdx];
}
function reset(){ for (const k in defaults) elements[k].value = defaults[k];
  ['brightline','interestonly','liqbasis','realmode'].forEach(id => { documentStub.getElementById(id).checked = false; }); }

// T1: defaults run end-to-end, winner Keep, break-even solver in verdict
reset(); api.recalc();
const nominalKeep = money(get('sum-keep'));
check('T1 defaults compute', get('sum-winner') === 'Keep' && nominalKeep > 800000 && nominalKeep < 1000000,
  'winner=' + get('sum-winner') + ' keep=' + get('sum-keep'));
check('T1 break-even solver shown', /capital growth/.test(get('sum-be')), get('sum-be'));

// T2: 0% interest must still amortize (16k/yr principal on 400k over 25y)
reset(); elements['interest'].value = '0'; elements['rentgrowth'].value = '0'; elements['costinfl'].value = '0';
api.recalc();
check('T2 zero-rate cashflow', money(get('sum-cf')) === -3069, get('sum-cf'));
check('T2 zero-rate amortizes', money(cell(14, 2)) === 160000, cell(14, 2));

// T3: interest-only — constant balance, CF = rent - opex - interest
reset(); elements['interestonly'].checked = true; elements['rentgrowth'].value = '0'; elements['costinfl'].value = '0';
api.recalc();
check('T3 interest-only cashflow', money(get('sum-cf')) === -6700, get('sum-cf'));
check('T3 interest-only balance constant', money(cell(14, 2)) === 400000, cell(14, 2));

// T4: deferred sale — Sell tracks Keep exactly before the sale year
reset(); elements['sellyear'].value = '5'; api.recalc();
check('T4 pre-sale years identical', cell(2, 6) === cell(2, 7) && money(cell(2, 8)) === 0,
  cell(2, 6) + ' vs ' + cell(2, 7));
check('T4 sale-year card sub', /Year 5/.test(get('sum-equity-sub')), get('sum-equity-sub'));

// T5: liquidation basis lowers Keep net worth by future selling costs
reset(); api.recalc(); const keepPlain = money(get('sum-keep'));
elements['liqbasis'].checked = true; api.recalc();
check('T5 liquidation basis', money(get('sum-keep')) < keepPlain,
  keepPlain + ' -> ' + get('sum-keep'));

// T6: bright-line — selling costs deductible from the gain
// cost=25500, gain=124500, tax=41085, proceeds=750000-400000-25500-41085=283415
reset(); elements['brightline'].checked = true; api.recalc();
check('T6 bright-line proceeds', money(get('sum-equity')) === 283415, get('sum-equity'));

// T7: typed values clamp to min/max in the parsed params
reset(); elements['deductible'].value = '250';
check('T7 clamp deductible', api.parseParams(api.collectState()).deductiblePct === 1,
  String(api.parseParams(api.collectState()).deductiblePct));

// T8: years beyond max clamps to 40 rows
reset(); elements['years'].value = '99'; api.recalc();
check('T8 years clamp', elements['tableBody'].innerHTML.split('</tr>').filter(r => r.indexOf('<td>') >= 0).length === 40);

// T9: today's-dollars mode deflates by (1+inflation)^year
reset(); api.recalc(); const nom = money(get('sum-keep'));
elements['realmode'].checked = true; api.recalc();
const expReal = nom / Math.pow(1.02, 15);
check('T9 real mode deflation', Math.abs(money(get('sum-keep')) - expReal) < 2,
  get('sum-keep') + ' vs expected ' + Math.round(expReal));
check('T9 real tag on titles', /Today/.test(get('tableTitle')), get('tableTitle'));

// T10: gross yield on the cashflow card (550*52/750000 = 3.8%)
reset(); api.recalc();
check('T10 gross yield', /3\.8%/.test(get('sum-cf-sub')), get('sum-cf-sub'));
check('T10 return on equity', /p\.a\. on today/.test(get('sum-keep-sub')), get('sum-keep-sub'));

// T11: sensitivity grid — 25 cells, exactly one marked current, both colors plausible
reset(); api.recalc();
const grid = elements['sensGrid'].innerHTML;
check('T11 sensitivity 25 cells', (grid.match(/<td/g) || []).length === 25);
check('T11 one current cell', (grid.match(/current/g) || []).length === 1);

// T12: scenarios save and render alongside the live row
reset(); api.recalc();
elements['scenName'].value = 'Test A';
api.saveScenario();
check('T12 scenario stored', api.getScenarios().length === 1 && api.getScenarios()[0].name === 'Test A');
check('T12 scenario listed', /Test A/.test(elements['scenList'].innerHTML) && /Current inputs/.test(elements['scenList'].innerHTML));

out.push('');
out.push(pass + ' passed, ' + fail + ' failed');
if (fail > 0) out.push('*** FAILURES ***');
out.join('\n');
