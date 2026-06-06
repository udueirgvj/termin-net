// ══════════════════════════════════════════════════════════
// Blockchain Monitor — Off-Chain Settlement System
// تشغيل: node blockchain_monitor.js
// يعمل على سيرفر Node.js (Railway / Render / VPS)
// ══════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// ══ إعدادات ══
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY', // مش anon key
  CHECK_INTERVAL: 30000, // كل 30 ثانية

  // عناوين محفظة الشركة
  COMPANY_WALLETS: {
    ETH:  '0xC5317f5701d75B1720CBeb0316C3E8bF241deAbB',
    BNB:  '0xC5317f5701d75B1720CBeb0316C3E8bF241deAbB',
    USDT_ERC20: '0xC5317f5701d75B1720CBeb0316C3E8bF241deAbB',
    USDT_BEP20: '0xC5317f5701d75B1720CBeb0316C3E8bF241deAbB',
    TRX:  'TNgzaheejL2HEwLnFT7dd6yFsQEUJHRhS1',
    USDT_TRC20: 'TNgzaheejL2HEwLnFT7dd6yFsQEUJHRhS1',
    BTC:  'bc1qj7fpz7kqhdrzxfs8fd00gkayslydex5d2za29c',
    SOL:  '6A1T3aWB43oTbEvcirgbMvwa73SmgwjTstVvub5Xh9Yv',
    XRP:  'r47hcyZoXAFvvshqDAwEHn5UvjVg47Z4kQ',
  },

  // API Keys (مجانية)
  APIS: {
    BSCSCAN:   process.env.BSCSCAN_API_KEY || '',    // bscscan.com
    ETHERSCAN: process.env.ETHERSCAN_API_KEY || '',  // etherscan.io
    TRONGRID:  process.env.TRONGRID_API_KEY || '',   // trongrid.io
  },

  // عقود USDT
  CONTRACTS: {
    USDT_ERC20: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    USDT_BEP20: '0x55d398326f99059fF775485246999027B3197955',
    USDT_TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  }
};

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);

// ══ Helper: HTTP GET ══
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ══ جلب المعاملات الواردة ══

// BTC — mempool.space (مجاني بدون key)
async function checkBTC() {
  const addr = CONFIG.COMPANY_WALLETS.BTC;
  const data = await httpGet(`https://mempool.space/api/address/${addr}/txs`);
  return (data || []).map(tx => {
    const out = tx.vout?.find(v => v.scriptpubkey_address === addr);
    if (!out) return null;
    return {
      hash: tx.txid,
      amount: out.value / 1e8,
      symbol: 'BTC',
      memo: tx.txid.substring(0, 8), // أول 8 أحرف كـ memo
    };
  }).filter(Boolean);
}

// ETH — Etherscan
async function checkETH() {
  const addr = CONFIG.COMPANY_WALLETS.ETH;
  const key = CONFIG.APIS.ETHERSCAN;
  const data = await httpGet(
    `https://api.etherscan.io/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&sort=desc&apikey=${key}`
  );
  return (data?.result || [])
    .filter(tx => tx.to?.toLowerCase() === addr.toLowerCase() && tx.value > 0)
    .map(tx => ({
      hash: tx.hash,
      amount: parseInt(tx.value) / 1e18,
      symbol: 'ETH',
      memo: tx.input !== '0x' ? tx.input.substring(2, 18) : tx.hash.substring(2, 18),
    }));
}

// USDT ERC20 — Etherscan
async function checkUSDT_ERC20() {
  const addr = CONFIG.COMPANY_WALLETS.USDT_ERC20;
  const contract = CONFIG.CONTRACTS.USDT_ERC20;
  const key = CONFIG.APIS.ETHERSCAN;
  const data = await httpGet(
    `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${contract}&address=${addr}&sort=desc&apikey=${key}`
  );
  return (data?.result || [])
    .filter(tx => tx.to?.toLowerCase() === addr.toLowerCase())
    .map(tx => ({
      hash: tx.hash,
      amount: parseInt(tx.value) / 1e6,
      symbol: 'USDT',
      network: 'ERC20',
      memo: tx.hash.substring(2, 18),
    }));
}

// BNB — BSCScan
async function checkBNB() {
  const addr = CONFIG.COMPANY_WALLETS.BNB;
  const key = CONFIG.APIS.BSCSCAN;
  const data = await httpGet(
    `https://api.bscscan.com/api?module=account&action=txlist&address=${addr}&sort=desc&apikey=${key}`
  );
  return (data?.result || [])
    .filter(tx => tx.to?.toLowerCase() === addr.toLowerCase() && tx.value > 0)
    .map(tx => ({
      hash: tx.hash,
      amount: parseInt(tx.value) / 1e18,
      symbol: 'BNB',
      memo: tx.hash.substring(2, 18),
    }));
}

// USDT BEP20 — BSCScan
async function checkUSDT_BEP20() {
  const addr = CONFIG.COMPANY_WALLETS.USDT_BEP20;
  const contract = CONFIG.CONTRACTS.USDT_BEP20;
  const key = CONFIG.APIS.BSCSCAN;
  const data = await httpGet(
    `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${contract}&address=${addr}&sort=desc&apikey=${key}`
  );
  return (data?.result || [])
    .filter(tx => tx.to?.toLowerCase() === addr.toLowerCase())
    .map(tx => ({
      hash: tx.hash,
      amount: parseInt(tx.value) / 1e18,
      symbol: 'USDT',
      network: 'BEP20',
      memo: tx.hash.substring(2, 18),
    }));
}

// TRX — TronGrid
async function checkTRX() {
  const addr = CONFIG.COMPANY_WALLETS.TRX;
  const key = CONFIG.APIS.TRONGRID;
  const data = await httpGet(
    `https://api.trongrid.io/v1/accounts/${addr}/transactions?limit=50&only_to=true`
  );
  return (data?.data || []).map(tx => {
    const contract = tx.raw_data?.contract?.[0];
    if (!contract || contract.type !== 'TransferContract') return null;
    const val = contract.parameter?.value;
    if (!val || val.to_address !== addr) return null;
    return {
      hash: tx.txID,
      amount: val.amount / 1e6,
      symbol: 'TRX',
      memo: tx.txID.substring(0, 16),
    };
  }).filter(Boolean);
}

// USDT TRC20 — TronGrid
async function checkUSDT_TRC20() {
  const addr = CONFIG.COMPANY_WALLETS.USDT_TRC20;
  const contract = CONFIG.CONTRACTS.USDT_TRC20;
  const key = CONFIG.APIS.TRONGRID;
  const data = await httpGet(
    `https://api.trongrid.io/v1/accounts/${addr}/transactions/trc20?limit=50&contract_address=${contract}`
  );
  return (data?.data || [])
    .filter(tx => tx.to === addr)
    .map(tx => ({
      hash: tx.transaction_id,
      amount: parseInt(tx.value) / 1e6,
      symbol: 'USDT',
      network: 'TRC20',
      memo: tx.transaction_id.substring(0, 16),
    }));
}

// SOL — Solana RPC
async function checkSOL() {
  const addr = CONFIG.COMPANY_WALLETS.SOL;
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'getSignaturesForAddress',
    params: [addr, { limit: 20 }]
  });
  // POST request
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.mainnet-beta.solana.com',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          const sigs = d?.result || [];
          resolve(sigs.map(s => ({
            hash: s.signature,
            amount: 0, // يحتاج getTransaction للحصول على المبلغ
            symbol: 'SOL',
            memo: s.memo || s.signature.substring(0, 16),
          })));
        } catch { resolve([]); }
      });
    });
    req.write(body);
    req.end();
  });
}

// XRP — Ripple
async function checkXRP() {
  const addr = CONFIG.COMPANY_WALLETS.XRP;
  const data = await httpGet(
    `https://data.ripple.com/v2/accounts/${addr}/transactions?type=Payment&descending=true&limit=20`
  );
  return (data?.transactions || [])
    .filter(tx => tx.tx?.Destination === addr)
    .map(tx => ({
      hash: tx.hash,
      amount: (parseInt(tx.tx?.Amount) || 0) / 1e6,
      symbol: 'XRP',
      memo: tx.tx?.DestinationTag?.toString() || tx.hash.substring(0, 8),
    }));
}

// ══ معالجة المعاملة الواردة ══
async function processDeposit(tx) {
  // تحقق إذا المعاملة معالجة مسبقاً
  const { data: existing } = await sb
    .from('blockchain_deposits')
    .select('id')
    .eq('tx_hash', tx.hash)
    .maybeSingle();

  if (existing) return; // تم معالجتها مسبقاً

  console.log(`📥 إيداع جديد: ${tx.amount} ${tx.symbol} | Hash: ${tx.hash}`);

  // البحث عن المستخدم بالـ memo (deposit_tag)
  const { data: user } = await sb
    .from('profiles')
    .select('id, display_name')
    .eq('deposit_tag', tx.memo)
    .maybeSingle();

  // حفظ المعاملة في قاعدة البيانات
  await sb.from('blockchain_deposits').insert({
    tx_hash: tx.hash,
    symbol: tx.symbol,
    network: tx.network || tx.symbol,
    amount: tx.amount,
    memo: tx.memo,
    user_id: user?.id || null,
    status: user ? 'credited' : 'pending', // pending إذا لم يُعرف المستخدم
    created_at: new Date().toISOString(),
  });

  if (!user) {
    console.log(`⚠️ لم يُعرف المستخدم للـ memo: ${tx.memo}`);
    return;
  }

  // إضافة الرصيد للمستخدم
  const { data: existing_balance } = await sb
    .from('wallet_balances')
    .select('balance')
    .eq('user_id', user.id)
    .eq('symbol', tx.symbol)
    .maybeSingle();

  const newBalance = (existing_balance?.balance || 0) + tx.amount;

  await sb.from('wallet_balances').upsert({
    user_id: user.id,
    symbol: tx.symbol,
    balance: newBalance,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,symbol' });

  // سجل المعاملة
  await sb.from('wallet_transactions').insert({
    user_id: user.id,
    symbol: tx.symbol,
    amount: tx.amount,
    type: 'deposit',
    note: `إيداع بلوكتشين | ${tx.network || tx.symbol}`,
    tx_hash: tx.hash,
    created_at: new Date().toISOString(),
  });

  console.log(`✅ تم إضافة ${tx.amount} ${tx.symbol} لـ ${user.display_name}`);
}

// ══ الحلقة الرئيسية ══
async function monitor() {
  console.log('🔍 فحص البلوكتشين...');
  try {
    const checkers = [
      checkBTC, checkETH, checkBNB,
      checkTRX, checkSOL, checkXRP,
      checkUSDT_ERC20, checkUSDT_BEP20, checkUSDT_TRC20,
    ];

    for (const checker of checkers) {
      try {
        const txs = await checker();
        for (const tx of txs) {
          if (tx.amount > 0) await processDeposit(tx);
        }
      } catch (e) {
        console.error(`خطأ في ${checker.name}:`, e.message);
      }
    }
  } catch (e) {
    console.error('خطأ عام:', e.message);
  }
}

// ══ البدء ══
console.log('🚀 Blockchain Monitor started');
monitor();
setInterval(monitor, CONFIG.CHECK_INTERVAL);
