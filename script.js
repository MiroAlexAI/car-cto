// Elements
const inputs = {
    // Old Car
    oldPrice: document.getElementById('old-price'),
    savings: document.getElementById('savings'),
    oldConsumption: document.getElementById('old-consumption'),
    oldMaintenance: document.getElementById('old-maintenance'),
    oldTax: document.getElementById('old-tax'),

    // Risk & Depr
    breakdownProb: document.getElementById('breakdown-prob'),
    repairCost: document.getElementById('repair-cost'),
    oldDepr: document.getElementById('old-depreciation'),
    newDepr: document.getElementById('new-depreciation'),
    overhaulInterval: document.getElementById('overhaul-interval'),

    // Common
    riskGrowth: document.getElementById('risk-growth'),
    riskMileage: document.getElementById('risk-mileage'),
    currentMileage: document.getElementById('current-mileage'),
    mileage: document.getElementById('mileage'),
    fuelPrice: document.getElementById('fuel-price'),
    years: document.getElementById('years'),

    // New Car
    newPrice: document.getElementById('new-price'),
    newConsumption: document.getElementById('new-consumption'),
    newMaintenance: document.getElementById('new-maintenance'),
    newTax: document.getElementById('new-tax'),
    // Finance
    inflation: document.getElementById('inflation'),
    discountRate: document.getElementById('discount-rate'),
};

const displays = {
    // Value Displays
    oldPrice: document.getElementById('old-price-val'),
    savings: document.getElementById('savings-val'),
    oldCons: document.getElementById('old-consumption-val'),
    oldMaint: document.getElementById('old-maintenance-val'),
    oldTax: document.getElementById('old-tax-val'),

    overhaulInt: document.getElementById('overhaul-interval-val'),
    breakdownProb: document.getElementById('breakdown-prob-val'),
    repairCost: document.getElementById('repair-cost-val'),
    currentMileage: document.getElementById('current-mileage-val'),

    newPrice: document.getElementById('new-price-val'),
    newCons: document.getElementById('new-consumption-val'),
    newMaint: document.getElementById('new-maintenance-val'),
    newTax: document.getElementById('new-tax-val'),

    mileage: document.getElementById('mileage-val'),
    years: document.getElementById('years-val'),
    fuelPrice: document.getElementById('fuel-price-val'),

    oldDepr: document.getElementById('old-depr-val'),
    newDepr: document.getElementById('new-depr-val'),
    inflation: document.getElementById('inflation-val'),
    discountRate: document.getElementById('discount-rate-val'),

    // Results in UI
    resYears: document.getElementById('res-years'),
    totalDiff: document.getElementById('total-diff'),
    recommendation: document.getElementById('recommendation'),
    oldTotalCost: document.getElementById('old-total-cost'),
    newTotalCost: document.getElementById('new-total-cost'),
    upgradeCost: document.getElementById('upgrade-cost'),

    // Optimization
    optResult: document.getElementById('optimization-result'),
    optText: document.getElementById('opt-text'),
    optPrice: document.getElementById('opt-price'),
    optCons: document.getElementById('opt-cons'),

    // Modal
    saveModal: document.getElementById('save-modal'),
    reportContent: document.getElementById('modal-report-content'),

    // AI Panel
    aiPromptText: document.getElementById('ai-prompt-text'),
};

const buttons = {
    optimize: document.getElementById('optimize-btn'),
    save: document.getElementById('save-btn'),
    closeModal: document.querySelector('.close-modal'),
    printReport: document.getElementById('print-report'),
    copyReport: document.getElementById('copy-report'),
    openQwen: document.getElementById('open-qwen-btn'),
};

let chart = null;

// Initialize
function init() {
    // Add event listeners
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                updateDisplays();
                calculate();
                hideOptimization();
                generateAIPrompt();
            });
        }
    });

    if (buttons.optimize) {
        buttons.optimize.addEventListener('click', optimize);
    }

    if (buttons.save) {
        buttons.save.addEventListener('click', openReport);
    }

    if (buttons.closeModal) {
        buttons.closeModal.addEventListener('click', () => displays.saveModal.classList.add('hidden'));
    }

    if (buttons.printReport) {
        buttons.printReport.addEventListener('click', () => window.print());
    }

    if (buttons.copyReport) {
        buttons.copyReport.addEventListener('click', copyReportToClipboard);
    }

    if (buttons.openQwen) {
        buttons.openQwen.addEventListener('click', openQwen);
    }

    // Close on overlay click
    if (displays.saveModal) {
        displays.saveModal.addEventListener('click', (e) => {
            if (e.target === displays.saveModal) displays.saveModal.classList.add('hidden');
        });
    }

    // Specific event listeners for elements that trigger calculate on 'change' or need special handling
    if (inputs.riskGrowth) inputs.riskGrowth.addEventListener('change', () => { calculate(); generateAIPrompt(); });
    if (inputs.riskMileage) inputs.riskMileage.addEventListener('change', () => { calculate(); generateAIPrompt(); });

    // Initial calcs
    updateDisplays();
    calculate();
    generateAIPrompt();
}

function updateDisplays() {
    // Format helper
    const fmt = (num) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num);
    const fmtCurrency = (num) => fmt(num) + ' ₽';
    const fmtMillions = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + ' млн ₽';
        if (num >= 1000) return (num / 1000).toFixed(0) + ' тыс ₽';
        return num + ' ₽';
    };

    if (displays.oldPrice) displays.oldPrice.textContent = fmtMillions(inputs.oldPrice.value);
    if (displays.savings) displays.savings.textContent = fmtCurrency(inputs.savings.value);
    if (displays.oldCons) displays.oldCons.textContent = inputs.oldConsumption.value;
    if (displays.oldMaint) displays.oldMaint.textContent = fmtCurrency(inputs.oldMaintenance.value);
    if (displays.oldTax) displays.oldTax.textContent = fmtCurrency(inputs.oldTax.value);

    if (displays.overhaulInt) displays.overhaulInt.textContent = (inputs.overhaulInterval.value / 1000) + ' тыс.';
    if (displays.breakdownProb) displays.breakdownProb.textContent = inputs.breakdownProb.value + '%';
    if (displays.repairCost) displays.repairCost.textContent = fmtCurrency(inputs.repairCost.value);

    if (displays.newPrice) displays.newPrice.textContent = fmtMillions(inputs.newPrice.value);
    if (displays.newCons) displays.newCons.textContent = inputs.newConsumption.value;
    if (displays.newMaint) displays.newMaint.textContent = fmtCurrency(inputs.newMaintenance.value);
    if (displays.newTax) displays.newTax.textContent = fmtCurrency(inputs.newTax.value);

    if (displays.mileage) displays.mileage.textContent = fmt(inputs.mileage.value);
    if (displays.years) displays.years.textContent = inputs.years.value;
    if (displays.fuelPrice) displays.fuelPrice.textContent = fmtCurrency(inputs.fuelPrice.value);

    if (displays.oldDepr) displays.oldDepr.textContent = inputs.oldDepr.value + '%';
    if (displays.newDepr) displays.newDepr.textContent = inputs.newDepr.value + '%';
    if (displays.inflation) displays.inflation.textContent = inputs.inflation.value + '%';
    if (displays.discountRate) displays.discountRate.textContent = inputs.discountRate.value + '%';
    if (displays.currentMileage) displays.currentMileage.textContent = fmt(inputs.currentMileage.value);

    if (displays.resYears) displays.resYears.textContent = inputs.years.value;
}

function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
}

function hideOptimization() {
    displays.optResult.style.display = 'none';
}

function getInputs() {
    const years = parseInt(inputs.years.value);
    const mileage = parseInt(inputs.mileage.value);
    const fuelPrice = parseFloat(inputs.fuelPrice.value);
    const startOdometer = parseInt(inputs.currentMileage.value) || 0;
    const overhaulInterval = parseInt(inputs.overhaulInterval.value);

    return {
        years,
        mileage,
        fuelPrice,
        breakdownProb: parseInt(inputs.breakdownProb.value),
        riskGrowth: inputs.riskGrowth.checked,
        riskMileage: inputs.riskMileage.checked,
        repairPrice: parseInt(inputs.repairCost.value),
        currentMileage: startOdometer,
        overhaulInterval,
        // Old
        oldCons: parseFloat(inputs.oldConsumption.value),
        oldMaint: parseInt(inputs.oldMaintenance.value),
        oldTax: parseInt(inputs.oldTax.value),
        oldPrice: parseInt(inputs.oldPrice.value),
        savings: parseInt(inputs.savings.value),
        oldDepr: parseFloat(inputs.oldDepr.value),
        // New
        newPrice: parseInt(inputs.newPrice.value),
        newCons: parseFloat(inputs.newConsumption.value),
        newMaint: parseInt(inputs.newMaintenance.value),
        newTax: parseInt(inputs.newTax.value),
        newDepr: parseFloat(inputs.newDepr.value),
        inflation: parseFloat(inputs.inflation.value),
        discountRate: parseFloat(inputs.discountRate.value)
    };
}

function calculate() {
    if (typeof TCOLogic === 'undefined') return;

    const data = getInputs();
    const result = TCOLogic.calculate(data);

    displays.oldTotalCost.textContent = formatMoney(result.finalOld);
    displays.newTotalCost.textContent = formatMoney(result.finalNew);

    const cashRequired = data.newPrice - (data.oldPrice + data.savings);
    displays.upgradeCost.textContent = formatMoney(cashRequired);

    displays.totalDiff.textContent = formatMoney(Math.abs(result.diff));

    if (result.diff < 0) {
        displays.totalDiff.style.color = '#4ade80';
        displays.recommendation.textContent = "✅ Выгодно";
        displays.recommendation.style.color = "#4ade80";
        displays.recommendation.style.backgroundColor = "rgba(74, 222, 128, 0.2)";
    } else {
        displays.totalDiff.style.color = '#f87171';
        displays.recommendation.textContent = "❌ Невыгодно";
        displays.recommendation.style.color = "#f87171";
        displays.recommendation.style.backgroundColor = "rgba(248, 113, 113, 0.2)";
    }

    updateChart(result);

    const riskLabel = document.querySelector('.sub-title');
    if (riskLabel) riskLabel.textContent = `Риски (Капремонтов: ${result.overhaulCount})`;
}

function optimize() {
    const data = getInputs();
    if (typeof TCOLogic === 'undefined') return;

    const res = TCOLogic.optimize(data);
    displays.optResult.style.display = 'block';

    displays.optPrice.textContent = res.recPrice > 0 ? formatMoney(res.recPrice) : "Невозможно";
    displays.optCons.textContent = res.recCons > 0 ? res.recCons.toFixed(1) + " л/100км" : "0 л";

    const summaryHtml = `
        <span style="font-size:0.85em; color:var(--text-secondary); display:block; margin-top:0.5rem; border-top:1px solid #dfe7ef; padding-top:0.5rem">
          <strong>Условия "Идеального Нового":</strong><br>
          • Риски поломок: 0%<br>
          • Расход топлива: ${res.recCons.toFixed(1)} л/100км (-10%)<br>
          • Обслуживание: -15% от старого<br>
          • Амортизация: ${inputs.newDepr.value}% в год
        </span>
    `;
    displays.optText.innerHTML = `Если новый авто будет надежнее и экономичнее:` + summaryHtml;
    displays.optResult.scrollIntoView({ behavior: 'smooth' });
}

function generateAIPrompt() {
    const data = getInputs();
    const result = TCOLogic.calculate(data);
    const money = (num) => formatMoney(num);
    const fmt = (num) => new Intl.NumberFormat('ru-RU').format(num);

    const prompt = `Ты — эксперт по ТОиР и финансовый аналитик. Проанализируй данные моего расчета TCO (Total Cost of Ownership) за ${data.years} лет.
    
ТЕКУЩИЙ АВТО:
- Цена: ${money(data.oldPrice)}
- Пробег: ${fmt(data.currentMileage)} км
- Расход: ${data.oldCons} л/100км
- Риск поломки: ${data.breakdownProb}% в год
- Затраты на ремонт/год: ${money(data.oldMaint)}
- Капремонт каждые: ${fmt(data.overhaulInterval)} км

НОВЫЙ АВТО:
- Цена: ${money(data.newPrice)}
- Расход: ${data.newCons} л/100км
- ТО/год: ${money(data.newMaint + data.newTax)}

УСЛОВИЯ:
- Пробег в год: ${fmt(data.mileage)} км
- Инфляция: ${data.inflation}%
- Ставка дисконта (NPV): ${data.discountRate}%

РЕЗУЛЬТАТ КАЛЬКУЛЯТОРА:
- TCO Старого: ${money(result.finalOld)}
- TCO Нового: ${money(result.finalNew)}
- Разница: ${money(Math.abs(result.diff))} (${result.diff < 0 ? 'экономия' : 'переплата'})

ЗАДАНИЕ:
1. Оцени адекватность расчета с точки зрения инженера по надежности.
2. Какие скрытые риски я могу не учитывать?
3. Дай совет: стоит ли менять авто сейчас, учитывая текущие экономические тренды?`;

    displays.aiPromptText.value = prompt;
}

function openQwen() {
    // Copy to clipboard first
    const text = displays.aiPromptText.value;
    navigator.clipboard.writeText(text).then(() => {
        const btn = buttons.openQwen;
        const originalText = btn.textContent;
        btn.textContent = '✅ Скопировано! Открываю...';
        setTimeout(() => {
            btn.textContent = originalText;
            window.open('https://chat.qwen.ai/', '_blank');
        }, 1500);
    });
}

function openReport() {
    const data = getInputs();
    const result = TCOLogic.calculate(data);
    const opt = TCOLogic.optimize(data);
    const fmt = (num) => new Intl.NumberFormat('ru-RU').format(num);
    const money = (num) => formatMoney(num);

    const reportHtml = `
        <div class="report-section">
            <h3>🚗 Текущий автомобиль</h3>
            <div class="report-grid">
                <div class="report-item"><span class="label">Рыночная цена:</span><span class="value">${money(data.oldPrice)}</span></div>
                <div class="report-item"><span class="label">Накопления/Долг:</span><span class="value">${money(data.savings)}</span></div>
                <div class="report-item"><span class="label">Расход (л/100км):</span><span class="value">${data.oldCons}</span></div>
                <div class="report-item"><span class="label">Ремонт/год:</span><span class="value">${money(data.oldMaint)}</span></div>
                <div class="report-item"><span class="label">Вероятность поломки:</span><span class="value">${data.breakdownProb}%</span></div>
                <div class="report-item"><span class="label">Текущий пробег:</span><span class="value">${fmt(data.currentMileage)} км</span></div>
                <div class="report-item"><span class="label">Ресурс (капремонт):</span><span class="value">${fmt(data.overhaulInterval)} км</span></div>
            </div>
        </div>

        <div class="report-section">
            <h3>✨ Новый автомобиль (Желаемый)</h3>
            <div class="report-grid">
                <div class="report-item"><span class="label">Цена покупки:</span><span class="value">${money(data.newPrice)}</span></div>
                <div class="report-item"><span class="label">Расход (л/100км):</span><span class="value">${data.newCons}</span></div>
                <div class="report-item"><span class="label">ТО/год (+КАСКО):</span><span class="value">${money(data.newMaint + data.newTax)}</span></div>
            </div>
        </div>

        <div class="report-section">
            <h3>⚙️ Условия расчета</h3>
            <div class="report-grid">
                <div class="report-item"><span class="label">Срок владения:</span><span class="value">${data.years} лет</span></div>
                <div class="report-item"><span class="label">Пробег в год:</span><span class="value">${fmt(data.mileage)} км</span></div>
                <div class="report-item"><span class="label">Инфляция:</span><span class="value">${data.inflation}%</span></div>
                <div class="report-item"><span class="label">Дисконт (NPV):</span><span class="value">${data.discountRate}%</span></div>
            </div>
        </div>

        <div class="report-section">
            <h3>📊 Результаты (NPV за ${data.years} лет)</h3>
            <div class="report-grid">
                <div class="report-item"><span class="label">Итого затрат (Старый):</span><span class="value">${money(result.finalOld)}</span></div>
                <div class="report-item"><span class="label">Итого затрат (Новый):</span><span class="value">${money(result.finalNew)}</span></div>
            </div>
            <div class="report-summary ${result.diff < 0 ? 'success' : 'danger'}">
                <strong>Вердикт:</strong> ${result.diff < 0 ? 'Покупка экономически выгодна.' : 'Покупка невыгодна, лучше оставить текущий авто.'}<br>
                Разница в затратах: <strong>${money(Math.abs(result.diff))}</strong> 
                (${result.diff < 0 ? 'экономия' : 'переплата'} за весь срок).
            </div>
        </div>

        <div class="report-section">
            <h3>💡 Рекомендации от Prostoev.NET</h3>
            <p style="font-size: 0.9em; margin-bottom: 1rem;">
                Для того чтобы замена автомобиля стала экономически целесообразной (TCO сравнялось), вам следует искать:
            </p>
            <div class="report-grid">
                <div class="report-item"><span class="label">Макс. цена покупки:</span><span class="value">${money(opt.recPrice)}</span></div>
                <div class="report-item"><span class="label">Целевой расход топлива:</span><span class="value">не более ${opt.recCons.toFixed(1)} л/100км</span></div>
                <div class="report-item"><span class="label">Затраты на ТО/год:</span><span class="value">до ${money(opt.params.targetMaint)}</span></div>
            </div>
        </div>
    `;

    displays.reportContent.innerHTML = reportHtml;
    displays.saveModal.classList.remove('hidden');
}

function copyReportToClipboard() {
    const text = displays.reportContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = buttons.copyReport;
        const originalText = btn.textContent;
        btn.textContent = '✅ Скопировано!';
        btn.style.backgroundColor = '#dcfce7';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 2000);
    });
}

function updateChart(result) {
    const ctx = document.getElementById('costChart').getContext('2d');
    const { labels, oldData, newData, oldDeprData, newDeprData, finalOld, finalNew, oldAnnualData, newAnnualData } = result;

    if (chart) chart.destroy();
    if (typeof Chart === 'undefined') return;

    const diffVal = finalNew - finalOld;
    const diffLabel = `Разница TCO: ${formatMoney(diffVal)} ${diffVal > 0 ? '(Дороже)' : '(Дешевле)'}`;

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Старый (TCO: ${formatMoney(finalOld)})`,
                    data: oldData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: `Новый (TCO: ${formatMoney(finalNew)})`,
                    data: newData,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.05)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Старый (Остаточная)',
                    data: oldDeprData,
                    borderColor: '#fca5a5',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Новый (Остаточная)',
                    data: newDeprData,
                    borderColor: '#7dd3fc',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'Старый (В год)',
                    data: oldAnnualData,
                    backgroundColor: 'rgba(239, 68, 68, 0.3)',
                    yAxisID: 'y1'
                },
                {
                    type: 'bar',
                    label: 'Новый (В год)',
                    data: newAnnualData,
                    backgroundColor: 'rgba(14, 165, 233, 0.3)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: ['Сравнение TCO', diffLabel], font: { size: 14, family: 'Inter' } },
                legend: { labels: { color: '#64748b', font: { family: 'Inter', size: 10 }, boxWidth: 15 } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label.split('(')[0].trim()}: ${formatMoney(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: { type: 'linear', position: 'left', ticks: { font: { size: 9 } } },
                y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
}

init();
