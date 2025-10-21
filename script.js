/* ========== CONFIG ========== */
/* Replace with your GoHighLevel webhook/form endpoint to store leads.
   If left empty (''), the code will display results but not POST to server */
const webhookUrl = ''; // <-- PUT YOUR GHL WEBHOOK URL HERE, e.g. https://hooks.example.com/ghl

/* ========== FLOW LOGIC ========== */
(function () {
    const totalSteps = 7;
    let current = 1;

    const showStep = (n) => {
        if (n < 1) n = 1;
        if (n > totalSteps) n = totalSteps;
        current = n;

        // Toggle step visibility
        document.querySelectorAll('.step').forEach(s => {
            s.classList.toggle('active', Number(s.dataset.step) === n);
        });

        // Update progress bar
        const pct = Math.round(((n - 1) / (totalSteps - 1)) * 100);
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('stepIndicator').textContent = `Step ${n} of ${totalSteps}`;

        // Update nav buttons
        document.getElementById('prevBtn').style.display = (n === 1 ? 'none' : 'inline-block');
        document.getElementById('nextBtn').textContent = (n === totalSteps ? 'Finish Analysis' : 'Next →');

        // Scroll to top of section
        document.getElementById('ut-reia-calc-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Initialize first step
    showStep(1);

    // Handle Next button
    document.getElementById('nextBtn').addEventListener('click', () => {
        if (current < totalSteps) {
            if (!validateStep(current)) return;
            showStep(current + 1);
        } else {
            if (!validateStep(current)) return;
            computeResults();
        }
    });

    // Handle Back button
    document.getElementById('prevBtn').addEventListener('click', () => showStep(current - 1));

    // Help toggle buttons
    document.querySelectorAll('.help-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.help;
            const el = document.getElementById(id);
            if (el) el.style.display = (el.style.display === 'none' ? 'block' : 'none');
        });
    });

    // Validate required fields per step
    function validateStep(step) {
        try {
            if (step === 2) {
                const arv = Number(document.getElementById('arv').value);
                const dp = Number(document.getElementById('desiredProfit').value);
                if (!arv || arv <= 0) { alert('Please enter a valid ARV (After Repair Value).'); return false; }
                if (!dp || dp < 0) { alert('Please enter a desired profit amount (0 or greater).'); return false; }
            }
            if (step === 3) {
                const p = Number(document.getElementById('purchasePrice').value);
                if (!p || p <= 0) { alert('Please enter a valid purchase price.'); return false; }
            }
            if (step === 4) {
                const r = Number(document.getElementById('repairs').value);
                if (!r || r < 0) { alert('Please enter repair costs (0 or greater).'); return false; }
            }
            return true;
        } catch (e) { console.error(e); return true; }
    }

    /* ========== CALCULATION ========== */
    function parseNum(id) {
        const v = document.getElementById(id).value;
        return v ? Number(v) : 0;
    }

    function computeResults() {
        const arv = parseNum('arv');
        const desiredProfit = parseNum('desiredProfit');
        const purchasePrice = parseNum('purchasePrice');
        const purchaseClosing = parseNum('purchaseClosing');
        const repairs = parseNum('repairs');
        const holdingMonthly = parseNum('holdingMonthly');
        const holdingTimeMonths = parseNum('holdingTime');
        const agentCommissionPct = parseNum('agentCommission') || 0;
        const saleClosing = parseNum('saleClosing');

        const holdingCostsTotal = holdingMonthly * holdingTimeMonths;
        const agentCommissionAmount = (arv * (agentCommissionPct / 100));
        const totalInvestment = purchasePrice + purchaseClosing + repairs + holdingCostsTotal + agentCommissionAmount + saleClosing;
        const saleProceeds = arv;
        const profit = saleProceeds - totalInvestment;
        const roi = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;

        const resEl = document.getElementById('finalResults');
        resEl.style.display = 'block';
        resEl.innerHTML = `
      <div class="results" role="region" aria-live="polite">
        <h3>Analysis Summary</h3>
        <div class="line"><div>After Repair Value (ARV)</div><div>$${arv.toLocaleString()}</div></div>
        <div class="line"><div>Total Investment</div><div>$${totalInvestment.toLocaleString()}</div></div>
        <div class="line"><div>Estimated Profit</div><div>$${profit.toLocaleString()}</div></div>
        <div class="line"><div>ROI</div><div>${roi.toFixed(1)}%</div></div>
        <div style="padding-top:8px;color:#fff;" class="small">
          ${profit >= desiredProfit ? '✅ Meets desired profit target.' : '⚠️ Does not meet desired profit target.'}
        </div>
      </div>
    `;

        const breakdown = document.createElement('div');
        breakdown.style.marginTop = '12px';
        breakdown.innerHTML = `
      <div style="background:#fff;padding:12px;border-radius:10px;color:var(--blue)">
        <div style="font-weight:700;margin-bottom:6px">Cost Breakdown</div>
        <div class="line" style="color:var(--blue)"><div>Purchase Price</div><div>$${purchasePrice.toLocaleString()}</div></div>
        <div class="line" style="color:var(--blue)"><div>Purchase Closing</div><div>$${purchaseClosing.toLocaleString()}</div></div>
        <div class="line" style="color:var(--blue)"><div>Repairs</div><div>$${repairs.toLocaleString()}</div></div>
        <div class="line" style="color:var(--blue)"><div>Holding Costs</div><div>$${holdingCostsTotal.toLocaleString()}</div></div>
        <div class="line" style="color:var(--blue)"><div>Agent Commission</div><div>$${agentCommissionAmount.toLocaleString()}</div></div>
        <div class="line" style="color:var(--blue)"><div>Sale Closing</div><div>$${saleClosing.toLocaleString()}</div></div>
      </div>
    `;
        resEl.appendChild(breakdown);
        resEl.dataset.calculated = 'true';
        document.getElementById('sendLead').disabled = false;
    }

    /* ========== LEAD SUBMISSION ========== */
    document.getElementById('sendLead').addEventListener('click', async () => {
        const name = document.getElementById('leadName').value.trim();
        const email = document.getElementById('leadEmail').value.trim();

        if (!name || !email) { alert('Please enter your name and email to receive the report.'); return; }
        const resultsArea = document.getElementById('finalResults');
        if (!resultsArea || resultsArea.style.display === 'none') { alert('Please finish the analysis first (Finish Analysis).'); return; }

        const payload = {
            name, email,
            street: document.getElementById('street').value || '',
            city: document.getElementById('city').value || '',
            state: document.getElementById('state').value || '',
            zip: document.getElementById('zip').value || '',
            arv: document.getElementById('arv').value || '',
            desiredProfit: document.getElementById('desiredProfit').value || '',
            purchasePrice: document.getElementById('purchasePrice').value || '',
            purchaseClosing: document.getElementById('purchaseClosing').value || '',
            repairs: document.getElementById('repairs').value || '',
            holdingMonthly: document.getElementById('holdingMonthly').value || '',
            holdingTimeMonths: document.getElementById('holdingTime').value || '',
            agentCommissionPct: document.getElementById('agentCommission').value || '',
            saleClosing: document.getElementById('saleClosing').value || '',
            timestamp: new Date().toISOString()
        };

        const btn = document.getElementById('sendLead');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            if (webhookUrl && webhookUrl.trim().length > 5) {
                const resp = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) throw new Error('Network response not ok');
                alert('Thanks! Your report has been sent — check your email.');
            } else {
                console.log('Lead payload:', payload);
                alert('Demo: no webhook configured. Replace webhookUrl in the script to post leads automatically.');
            }
        } catch (err) {
            console.error(err);
            alert('There was an error sending your report. Please try again later.');
            btn.disabled = false;
            btn.textContent = 'Send My Report';
            return;
        }

        btn.textContent = 'Sent ✓';
        btn.style.background = 'var(--gold)';
    });

    window.utReiaCalc = { showStep, computeResults };
})();
