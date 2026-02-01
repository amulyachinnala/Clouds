(function () {
    'use strict';

    if (!window.Chart || !window.API) {
        return;
    }

    const monthlyEl = document.getElementById('monthly-budget-chart');
    const allowanceEl = document.getElementById('allowance-chart');

    if (!monthlyEl && !allowanceEl) {
        return;
    }

    const palette = ['#6FB98F', '#F2C94C', '#F28482', '#9AD0EC', '#CDB4DB', '#FFD166', '#06D6A0', '#118AB2'];
    const incomeColorMap = { 'Needs': '#F2C94C', 'Savings': '#6FCF97', 'Spend Pool': '#FDE68A' };
    const remainingColor = '#E5E7EB';
    const pspColorMap = {
        'Remaining': remainingColor,
        'PSP Remaining': remainingColor,
        'Unlocked Remaining': remainingColor
    };

    function createChart(el, defaultLabels, defaultColors) {
        return new Chart(el.getContext('2d'), {
            type: 'pie',
            data: {
                labels: defaultLabels,
                datasets: [{
                    data: defaultLabels.map(() => 0),
                    backgroundColor: defaultColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    const monthlyChart = monthlyEl ? createChart(monthlyEl, ['Needs', 'Savings', 'Spend Pool'], ['#F2C94C', '#6FCF97', '#FDE68A']) : null;
    const allowanceChart = allowanceEl ? createChart(allowanceEl, ['PSP Remaining'], ['#6FB98F']) : null;

    function updatePie(chart, pieData, colorMap) {
        if (!chart) return;
        const slices = (pieData && pieData.slices) ? pieData.slices : [];
        const labels = slices.map(slice => slice.label);
        const values = slices.map(slice => Number(slice.value || 0));
        const total = Number(pieData && pieData.total ? pieData.total : 0);
        const colors = labels.map((label, idx) => colorMap[label] || palette[idx % palette.length]);

        chart.data.labels = labels.length ? labels : ['No data'];
        chart.data.datasets[0].data = labels.length ? values : [0];
        chart.data.datasets[0].backgroundColor = labels.length ? colors : ['#e5e5e5'];
        chart.options.plugins.tooltip = {
            callbacks: {
                label: function (ctx) {
                    const amount = Number(ctx.raw || 0);
                    const percent = total > 0 ? (amount / total) * 100 : 0;
                    return ctx.label + ': $' + amount.toFixed(2) + ' (' + percent.toFixed(1) + '%)';
                }
            }
        };
        chart.update();
    }

    function toNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function buildPspPieFromPurchases(state, purchases) {
        const pspTotal = toNumber(state && state.psp_total);
        const slices = [];

        if (Array.isArray(purchases)) {
            purchases.forEach((purchase, index) => {
                if (!purchase) return;
                const label = purchase.item_name
                    || (purchase.item && purchase.item.name)
                    || purchase.itemName
                    || (purchase.item_id ? ('Item ' + purchase.item_id) : ('Item ' + (index + 1)));
                let value = purchase.cash_price;
                if (value === undefined || value === null) value = purchase.cash_spent;
                if (value === undefined || value === null) value = purchase.cashPrice;
                if (value === undefined || value === null) value = purchase.cashSpent;
                if ((value === undefined || value === null) && purchase.item) {
                    value = purchase.item.cash_price ?? purchase.item.cashPrice;
                }
                value = toNumber(value);
                if (value > 0) {
                    slices.push({ label: label, value: value });
                }
            });
        }

        if (!slices.length) {
            return {
                title: 'Spending Money',
                total: pspTotal,
                slices: [{ label: 'Remaining', value: pspTotal }]
            };
        }

        slices.sort((a, b) => String(a.label).localeCompare(String(b.label)));

        let spentTotal = slices.reduce((sum, slice) => sum + slice.value, 0);
        if (pspTotal <= 0) {
            slices.forEach(slice => { slice.value = 0; });
            spentTotal = 0;
        } else if (spentTotal > pspTotal && spentTotal > 0) {
            const scale = pspTotal / spentTotal;
            slices.forEach(slice => {
                slice.value = Math.round(slice.value * scale * 100) / 100;
            });
            spentTotal = slices.reduce((sum, slice) => sum + slice.value, 0);
        }

        const remaining = Math.max(pspTotal - spentTotal, 0);
        if (remaining > 0) {
            slices.push({ label: 'Remaining', value: remaining });
        }

        return { title: 'Spending Money', total: pspTotal, slices: slices };
    }

    async function loadCharts() {
        try {
            const charts = await API.charts();
            if (!charts || !charts.month_started) {
                updatePie(monthlyChart, { slices: [], total: 0 }, incomeColorMap);
                updatePie(allowanceChart, { slices: [], total: 0 }, pspColorMap);
                return;
            }
            updatePie(monthlyChart, charts.income_pie, incomeColorMap);
            let pspPie = charts.psp_pie;
            if (typeof API.listPurchases === 'function') {
                try {
                    const [state, purchases] = await Promise.all([
                        API.monthState(),
                        API.listPurchases()
                    ]);
                    pspPie = buildPspPieFromPurchases(state, purchases);
                } catch (err) {
                    pspPie = charts.psp_pie;
                }
            }
            updatePie(allowanceChart, pspPie, pspColorMap);
        } catch (err) {
            // ignore
        }
    }

    document.addEventListener('DOMContentLoaded', loadCharts);
})();
