// MONTHLY BUDGET PIE (3 slices)
const monthlyBudgetCtx = document
    .getElementById('monthly-budget-chart')
    .getContext('2d');

new Chart(monthlyBudgetCtx, {
    type: 'pie',
    data: {
        labels: ['Needs', 'Wants', 'Savings'],
        datasets: [{
            data: [50, 30, 20], // ← edit these later
            backgroundColor: [
                '#faea0bff',
                '#F2C94C',
                '#ededbaff'
            ]
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false
    }
});


// SPENDING ALLOWANCE PIE
const allowanceCtx = document
    .getElementById('allowance-chart')
    .getContext('2d');

new Chart(allowanceCtx, {
    type: 'pie',
    data: {
        labels: ['Remaining', 'Spent'],
        datasets: [{
            data: [70, 30], // ← dynamic later
            backgroundColor: [
                '#abddb4ff',
                '#62a553ff'
            ]
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false
    }
});
