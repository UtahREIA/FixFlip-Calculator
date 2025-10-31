/* ---------- Config ---------- */
const webhookUrl = 'WEBHOOK_URL'; // replace to post leads

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
function unformatCurrency(str){
  if(str === undefined || str === null) return 0;
  return Number(String(str).replace(/[^0-9.-]+/g,'')) || 0;
}
function formatCurrency(n){ if(isNaN(n)) n = 0; return '$' + Number(n).toLocaleString(); }

/* ---------- Autocomplete (Google Places) ---------- */
function initAutocomplete(){
  try{
    const input = $('street');
    const ac = new google.maps.places.Autocomplete(input, { componentRestrictions: {country:'us'}, types:['address'] });
    ac.addListener('place_changed', ()=>{
      const place = ac.getPlace();
      if(!place || !place.address_components) return;
      const comps = place.address_components; let number='',route='',city='',state='',postal='';
      comps.forEach(c=>{
        if(c.types.includes('street_number')) number = c.long_name;
        if(c.types.includes('route')) route = c.long_name;
        if(c.types.includes('locality') || c.types.includes('sublocality') ) city = c.long_name;
        if(c.types.includes('administrative_area_level_1')) state = c.short_name;
        if(c.types.includes('postal_code')) postal = c.long_name;
      });
      if(number||route) $('street').value = (number + ' ' + route).trim();
      if(city) $('city').value = city;
      if(state) $('state').value = state;
      if(postal) $('zip').value = postal;
    });
  }catch(e){ console.warn('Places API not loaded (replace API key)'); }
}
if(window.google && google.maps) initAutocomplete();

/* ---------- Steps navigation ---------- */
const steps = Array.from(document.querySelectorAll('.step'));
const totalSteps = steps.length; // should be 8
let current = 1;
function showStep(n){
  current = Math.max(1, Math.min(totalSteps, n));
  steps.forEach((s, i) => s.classList.toggle('active', i === current-1));
  $('progressFill').style.width = Math.round(((current-1)/(totalSteps-1))*100) + '%';
  $('stepIndicator').textContent = `Step ${current} of ${totalSteps}`;
  $('prevBtn').style.display = current === 1 ? 'none' : 'inline-block';
  $('nextBtn').textContent = current === totalSteps ? 'Finish Analysis' : 'Next →';
  document.getElementById('calcWrap').scrollIntoView({behavior:'smooth',block:'start'});
}
showStep(1);

// navigation handlers: robust (explicit compute on finish)
$('prevBtn').addEventListener('click', ()=> showStep(current-1));
$('nextBtn').addEventListener('click', ()=> {
  if(current < totalSteps){
    if(!validateStep(current)) return;
    showStep(current+1);
  } else {
    if(!validateStep(current)) return;
    // ensure editors saved before compute:
    recalcAllEditors();
    computeAndRender();
  }
});

function validateStep(step){
  try{
    if(step === 2){
      if(unformatCurrency($('arv').value) <= 0){ alert('Please enter valid ARV'); return false; }
    }
    if(step === 3){
      if(unformatCurrency($('purchasePrice').value) <= 0){ alert('Please enter purchase price'); return false; }
    }
    return true;
  }catch(e){ console.error(e); return true; }
}

/* ---------- Inline editors (add, recalc, save, cancel) ---------- */
function toggleEditor(section){
  const ed = $('editor-' + section);
  if(!ed) return;
  const open = ed.style.display === 'block';
  if(open){ ed.style.display = 'none'; ed.setAttribute('aria-hidden','true'); }
  else { ed.style.display = 'block'; ed.setAttribute('aria-hidden','false'); recalcEditor(section); }
}
function addItem(section){
  const editor = $('editor-' + section);
  if(!editor) return;
  const row = document.createElement('div'); row.className = 'item';
  // include loan-roll select for purchase items only
  const loanRollSelect = section === 'purchase' ? `<select class="item-loan-roll"><option value="upfront">Pay Upfront</option><option value="roll">Roll Into Loan</option></select>` : '';
  row.innerHTML = `
    <input class="item-label" placeholder="Label (eg. Title Fee)">
    <input class="item-value small-input" data-kind="fixed" placeholder="0">
    <select class="item-kind"><option value="fixed">$ (fixed)</option><option value="pct_price">% of Price</option><option value="pct_loan">% of Loan</option></select>
    ${loanRollSelect}
    <button type="button" class="icon-btn">🗑️</button>
  `;
  row.querySelector('.icon-btn').addEventListener('click', ()=> { row.remove(); recalcEditor(section); });
  const valInp = row.querySelector('.item-value');
  valInp.addEventListener('focus', function(){ this.value = this.value ? String(unformatCurrency(this.value)) : ''; });
  valInp.addEventListener('blur', function(){ this.value = this.value ? formatCurrency(unformatCurrency(this.value)) : this.value; recalcEditor(section); });
  row.querySelector('.item-kind').addEventListener('change', ()=> recalcEditor(section));
  const loanRoll = row.querySelector('.item-loan-roll');
  if(loanRoll) loanRoll.addEventListener('change', ()=> recalcEditor(section));
  const addArea = (section==='purchase')? $('purchase-add-area') : (section==='holding' ? $('holding-add-area') : $('finance-add-area'));
  addArea.appendChild(row);
  return row;
}

function recalcEditor(section){
  if(section === 'purchase') recalcPurchaseEditor();
  if(section === 'holding') recalcHoldingEditor();
  if(section === 'finance') recalcFinanceEditor();
}

function recalcPurchaseEditor(){
  const price = unformatCurrency($('purchasePrice').value);
  const loan = unformatCurrency($('loanAmount').value);
  const editor = $('editor-purchase'); if(!editor) return;
  let total = 0;
  Array.from(editor.querySelectorAll('.item')).forEach(item=>{
    const kind = (item.querySelector('.item-kind')||{}).value || (item.querySelector('.item-value')?.dataset?.kind || 'fixed');
    const valRaw = item.querySelector('.item-value') ? unformatCurrency(item.querySelector('.item-value').value) : 0;
    const loanRoll = item.querySelector('.item-loan-roll') ? item.querySelector('.item-loan-roll').value : 'upfront';
    let add = 0;
    if(kind === 'pct_price'){ add = (price * (valRaw/100)); }
    else if(kind === 'pct_loan'){ add = (loan * (valRaw/100)); }
    else { add = valRaw; }
    // if roll into loan, exclude from upfront purchase closing total
    if(item.querySelector('.item-loan-roll') && item.querySelector('.item-loan-roll').value === 'roll') {
      add = 0;
    }
    total += add;
  });
  $('purchaseEditorTotal').textContent = formatCurrency(total);
}

function recalcHoldingEditor(){
  const price = unformatCurrency($('purchasePrice').value);
  const loan = unformatCurrency($('loanAmount').value);
  const months = Number($('holdingTime').value) || 0;
  const editor = $('editor-holding'); if(!editor) return;
  let monthlyExtras = 0;
  Array.from(editor.querySelectorAll('.item')).forEach(item=>{
    const kind = (item.querySelector('.item-kind')||{}).value || 'fixed';
    const valRaw = unformatCurrency(item.querySelector('.item-value').value);
    let add = 0;
    if(kind === 'pct_price'){ add = (price * (valRaw/100)); }
    else if(kind === 'pct_loan'){ add = (loan * (valRaw/100)); }
    else add = valRaw;
    monthlyExtras += add;
  });
  $('holdingEditorTotal').textContent = formatCurrency(monthlyExtras);
  // recalc interest
  const loanAmount = unformatCurrency($('loanAmount').value);
  const rate = Number($('interestRate').value) || 0;
  const interestTotal = (loanAmount * (rate/100) * months) / 12;
  $('holdingInterest').textContent = formatCurrency(interestTotal);
  const holdingMonthlyManual = unformatCurrency($('holdingMonthly').value);
  const holdingTotal = (holdingMonthlyManual * months) + (monthlyExtras * months) + interestTotal;
  $('holdingTotalDisplay').textContent = formatCurrency(holdingTotal);
}

function recalcFinanceEditor(){
  const price = unformatCurrency($('purchasePrice').value);
  const loan = unformatCurrency($('loanAmount').value);
  const editor = $('editor-finance'); if(!editor) return;
  let total = 0;
  Array.from(editor.querySelectorAll('.item')).forEach(item=>{
    const kind = (item.querySelector('.item-kind')||{}).value || 'fixed';
    const valRaw = unformatCurrency(item.querySelector('.item-value').value);
    let add = 0;
    if(kind === 'pct_price') add = price * (valRaw/100);
    else if(kind === 'pct_loan') add = loan * (valRaw/100);
    else add = valRaw;
    total += add;
  });
  $('financeEditorTotal').textContent = formatCurrency(total);
}

/* save / cancel */
function saveEditor(section){
  if(section === 'purchase'){
    recalcPurchaseEditor();
    const extras = unformatCurrency($('purchaseEditorTotal').textContent);
    const manual = unformatCurrency($('purchaseClosing').value);
    $('purchaseClosing').value = formatCurrency(manual + extras);
    cancelEditor('purchase');
  } else if(section === 'holding'){
    recalcHoldingEditor();
    // get monthly extras & add to holdingMonthly value
    const extras = unformatCurrency($('holdingEditorTotal').textContent);
    const manual = unformatCurrency($('holdingMonthly').value);
    const newMonthly = manual + extras;
    $('holdingMonthly').value = formatCurrency(newMonthly);
    // ensure interest & total recalc after updating monthly
    recalcHoldingEditor();
    cancelEditor('holding');
  } else if(section === 'finance'){
    recalcFinanceEditor();
    // financing extras are stored in financeEditorTotal; they will be used during compute
    cancelEditor('finance');
  }
  // Ensure everything recalculated and visible values formatted
  recalcAllEditors();
}

function cancelEditor(section){
  const editor = $('editor-' + section);
  if(!editor) return;
  editor.style.display = 'none';
  editor.setAttribute('aria-hidden','true');
}

function recalcAllEditors(){ recalcPurchaseEditor(); recalcHoldingEditor(); recalcFinanceEditor(); }

/* attach initial listeners for default editor rows */
function attachEditorInit(editorId){
  const editor = $(editorId); if(!editor) return;
  Array.from(editor.querySelectorAll('.item')).forEach(item=>{
    const val = item.querySelector('.item-value');
    if(val){
      val.addEventListener('focus', ()=> { val.value = val.value ? String(unformatCurrency(val.value)) : ''; });
      val.addEventListener('blur', ()=> { val.value = val.value ? formatCurrency(unformatCurrency(val.value)) : val.value; recalcEditor(editorId.replace('editor-','')); });
    }
    const kind = item.querySelector('.item-kind');
    if(kind) kind.addEventListener('change', ()=> recalcEditor(editorId.replace('editor-','')));
    const loanRoll = item.querySelector('.item-loan-roll');
    if(loanRoll) loanRoll.addEventListener('change', ()=> recalcEditor(editorId.replace('editor-','')));
    const del = item.querySelector('.icon-btn');
    if(del) del.addEventListener('click', ()=> recalcEditor(editorId.replace('editor-','')) );
  });
}
attachEditorInit('editor-purchase');
attachEditorInit('editor-holding');
attachEditorInit('editor-finance');

/* ---------- Calculation & Charts ---------- */
let chartInvest=null, chartProfit=null;
function computeAndRender(){
  const arv = unformatCurrency($('arv').value);
  const desiredProfit = unformatCurrency($('desiredProfit').value);
  const purchasePrice = unformatCurrency($('purchasePrice').value);
  const purchaseClosingManual = unformatCurrency($('purchaseClosing').value);
  const repairs = unformatCurrency($('repairs').value);
  const holdingMonthly = unformatCurrency($('holdingMonthly').value);
  const holdingMonths = Number($('holdingTime').value) || 0;
  const loanAmount = unformatCurrency($('loanAmount').value);
  const interestRate = Number($('interestRate').value) || 0;
  const agentPct = Number($('agentCommission').value) || 0;
  const saleClosingManual = unformatCurrency($('saleClosing').value);

  // ensure editor totals up to date
  recalcAllEditors();
  const purchaseExtras = unformatCurrency($('purchaseEditorTotal').textContent || '0');
  const holdingExtrasMonthly = unformatCurrency($('holdingEditorTotal').textContent || '0');
  const financeExtras = unformatCurrency($('financeEditorTotal').textContent || '0');

  // interest simple
  const interestTotal = (loanAmount * (interestRate/100) * holdingMonths) / 12;

  // holding total = (monthly * months) + (holdingExtrasMonthly * months) + interestTotal
  const holdingTotal = (holdingMonthly * holdingMonths) + (holdingExtrasMonthly * holdingMonths) + interestTotal;

  const agentCommissionAmt = (arv * (agentPct/100));
  const totalInvestment = purchasePrice + purchaseClosingManual + purchaseExtras + repairs + holdingTotal + agentCommissionAmt + saleClosingManual + financeExtras;
  const profit = arv - totalInvestment;
  const roi = totalInvestment > 0 ? (profit / totalInvestment)*100 : 0;

  // MAO (70% rule minus repairs & desired profit)
  const mao = (arv * 0.7) - repairs - desiredProfit;

  $('finalResults').style.display = 'block';
  $('finalResults').innerHTML = `
    <div class="results">
      <h3 style="margin:0 0 8px">Analysis Summary</h3>
      <div class="line"><div>After Repair Value (ARV)</div><div>${formatCurrency(arv)}</div></div>
      <div class="line"><div>Total Investment</div><div>${formatCurrency(totalInvestment)}</div></div>
      <div class="line"><div>Estimated Profit</div><div>${formatCurrency(profit)}</div></div>
      <div class="line"><div>ROI</div><div>${roi.toFixed(1)}%</div></div>
      <div class="line"><div>Interest Paid</div><div>${formatCurrency(interestTotal)}</div></div>
      <div class="line" style="font-weight:700;color:var(--gold)">
        <div>Maximum Allowable Offer (MAO)</div><div>${formatCurrency(mao)}</div>
      </div>
      <div style="padding-top:8px;color:#fff;" class="muted">
        ${purchasePrice <= mao
          ? '✅ Your offer is within the MAO range.'
          : '⚠️ Offer exceeds the MAO limit — reconsider or adjust terms.'}
      </div>
    </div>
  `;

  $('numericBreakdown').style.display = 'block';
  $('numericBreakdown').innerHTML = `
    <div class="card">
      <div style="font-weight:700;margin-bottom:8px">Cost Breakdown</div>
      <div style="display:flex;justify-content:space-between;"><div>Purchase Price</div><div>${formatCurrency(purchasePrice)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Purchase Closing (manual + extras)</div><div>${formatCurrency(purchaseClosingManual + purchaseExtras)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Repairs</div><div>${formatCurrency(repairs)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Holding (incl interest)</div><div>${formatCurrency(holdingTotal)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Agent Commission</div><div>${formatCurrency(agentCommissionAmt)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Sale Closing</div><div>${formatCurrency(saleClosingManual)}</div></div>
      <div style="display:flex;justify-content:space-between;"><div>Financing Extras</div><div>${formatCurrency(financeExtras)}</div></div>
    </div>
  `;

  $('chartsArea').style.display = 'grid';
  const investLabels = ['Purchase','Closing & Fees','Repairs','Holding','Financing Extras'];
  const investData = [purchasePrice, (purchaseClosingManual + purchaseExtras), repairs, holdingTotal, financeExtras];

  if(chartInvest) try{ chartInvest.destroy(); }catch(e){}
  if(chartProfit) try{ chartProfit.destroy(); }catch(e){}

  chartInvest = new Chart($('chartInvest').getContext('2d'), {
    type:'doughnut',
    data:{ labels: investLabels, datasets:[{ data:investData, backgroundColor:['#1a2a4f','#D4AF37','#F39C12','#6C757D','#2E8B57'] }]},
    options:{
      plugins:{
        datalabels:{
          formatter: (value, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
            const pct = total ? (value/total*100).toFixed(1) : 0;
            return `${pct}%\n${formatCurrency(value)}`;
          },
          color:'#fff',
          font:{weight:'700',size:11},
          anchor:'center',
          clamp:true
        },
        legend:{position:'bottom'}
      },
      responsive:true,
    },
    plugins: [ChartDataLabels]
  });

  const actualProfit = Math.max(0, profit);
  const remaining = Math.max(0, desiredProfit - actualProfit);
  chartProfit = new Chart($('chartProfit').getContext('2d'), {
    type:'doughnut',
    data:{ labels:['Actual Profit','Remaining to Target'], datasets:[{ data:[actualProfit, remaining], backgroundColor:['#2E8B57','#1a2a4f'] }]},
    options:{
      plugins:{
        datalabels:{
          formatter: (value) => `${((value/(actualProfit+remaining||1))*100).toFixed(1)}%\n${formatCurrency(value)}`,
          color:'#fff',
          font:{weight:'700',size:11}
        },
        legend:{position:'bottom'}
      },
      responsive:true
    },
    plugins:[ChartDataLabels]
  });

  $('sendLead').disabled = false;
  $('finalResults').scrollIntoView({behavior:'smooth',block:'center'});
}

/* ---------- Send lead ---------- */
$('sendLead').addEventListener('click', async ()=>{
  const name = $('leadName').value.trim(), email = $('leadEmail').value.trim();
  if(!name || !email){ alert('Please enter name and email'); return; }
  const payload = {
    name, email,
    address: $('street').value || '',
    city: $('city').value || '',
    state: $('state').value || '',
    zip: $('zip').value || '',
    arv: unformatCurrency($('arv').value),
    desiredProfit: unformatCurrency($('desiredProfit').value),
    purchasePrice: unformatCurrency($('purchasePrice').value),
    purchaseClosing: unformatCurrency($('purchaseClosing').value),
    repairs: unformatCurrency($('repairs').value),
    holdingMonthly: unformatCurrency($('holdingMonthly').value),
    holdingTimeMonths: Number($('holdingTime').value) || 0,
    loanAmount: unformatCurrency($('loanAmount').value),
    interestRate: Number($('interestRate').value) || 0,
    agentCommissionPct: Number($('agentCommission').value) || 0,
    saleClosing: unformatCurrency($('saleClosing').value),
    timestamp: new Date().toISOString()
  };
  const btn = $('sendLead'); btn.disabled=true; btn.textContent='Sending...';
  try{
    if(webhookUrl && webhookUrl.length>5 && !webhookUrl.includes('YOUR_WEBHOOK_URL')){
      const r = await fetch(webhookUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(!r.ok) throw new Error('Network error');
      alert('Lead sent.');
    } else {
      console.log('Demo payload:', payload);
      alert('Demo: webhook not configured. Payload logged to console.');
    }
  }catch(err){ console.error(err); alert('Error sending lead.'); btn.disabled=false; btn.textContent='Send My Report'; return; }
  btn.textContent='Sent ✓'; btn.style.background='var(--gold-dark)';
});

/* ---------- PDF download ---------- */
$('downloadPDF').addEventListener('click', async ()=>{
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','pt','a4');
  const node = document.createElement('div');
  node.style.width = '1100px';
  node.style.padding = '18px';
  node.style.background = '#fff';
  node.innerHTML = `<h2>Utah REIA - Fix & Flip Report</h2>` + $('finalResults').innerHTML + $('numericBreakdown').innerHTML;
  const c1 = document.getElementById('chartInvest').toDataURL('image/png');
  const c2 = document.getElementById('chartProfit').toDataURL('image/png');
  const img1 = new Image(); img1.src = c1; img1.style.width='100%'; img1.style.marginTop='8px';
  const img2 = new Image(); img2.src = c2; img2.style.width='100%'; img2.style.marginTop='8px';
  node.appendChild(img1); node.appendChild(img2);

  await html2canvas(node, { scale: 1, useCORS:true, backgroundColor:'#fff' }).then(canvas => {
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdfW = pdf.internal.pageSize.getWidth();
    const imgW = pdfW - 40;
    const imgH = canvas.height * imgW / canvas.width;
    pdf.addImage(imgData,'JPEG',20,20,imgW,imgH);
    pdf.save('UtahREIA_FixFlip_Report.pdf');
  }).catch(e=>{
    console.error('PDF generation error',e);
    alert('Could not generate PDF. Try running on a hosted page (some environments block canvas).');
  });
});

/* ---------- Init formatting + listeners ---------- */
window.addEventListener('load', ()=>{
  // currency initial format
  ['arv','desiredProfit','purchasePrice','purchaseClosing','repairs','holdingMonthly','loanAmount','saleClosing'].forEach(id=>{
    const el = document.getElementById(id);
    if(el && el.value) el.value = formatCurrency(unformatCurrency(el.value));
    if(el) {
      el.addEventListener('focus', ()=> { el.value = el.value ? String(unformatCurrency(el.value)) : ''; });
      el.addEventListener('blur', ()=> { el.value = el.value ? formatCurrency(unformatCurrency(el.value)) : el.value; recalcAllEditors(); });
    }
  });

  const ir = $('interestRate'); if(ir) ir.addEventListener('input', recalcHoldingEditor);
  const ht = $('holdingTime'); if(ht) ht.addEventListener('change', recalcHoldingEditor);
  const la = $('loanAmount'); if(la) la.addEventListener('blur', ()=> { la.value = formatCurrency(unformatCurrency(la.value)); recalcAllEditors(); });

  recalcAllEditors();
});

/* expose for debugging */
window.utReiaCalc = { recalcAllEditors, computeAndRender, toggleEditor, saveEditor, cancelEditor };