<<<<<<< Updated upstream
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
=======
document.addEventListener("DOMContentLoaded", () => {
    // 1. Define Data for both charts
    const mainBudgetData = [
        { label: "Savings", size: 600, color: '#f5c71a' }, 
        { label: "Spending Money", size: 400, color: '#ffffe0' },
        { label: "Fixed Expenses", size: 1000, color: '#fff44f' }   
    ];

    const spendingData = [
        { label: "Dining Out", size: 150, color: '#a2fd47ff' },
        { label: "Hobbies", size: 150, color: '#3fa32cff' },
        { label: "Misc", size: 100, color: '#abddabff' }
    ];

    // 2. The Reusable Chart Function
    function initPieChart(canvasId, legendId, chartData) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext("2d");
        const legend = document.getElementById(legendId);
        let hoveredIndex = null;
        let mousePos = { x: 0, y: 0 };

        function drawTooltip(text, x, y) {
            ctx.save();
            ctx.font = "bold 16px Inter, sans-serif";
            const textWidth = ctx.measureText(text).width;
            
            // Tooltip Background
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(0,0,0,0.1)";
            ctx.fillRect(x + 15, y - 35, textWidth + 20, 30);
            
            // Tooltip Text
            ctx.fillStyle = "#1a1a1a";
            ctx.shadowBlur = 0;
            ctx.fillText(text, x + 25, y - 15);
            ctx.restore();
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const total = chartData.reduce((acc, val) => acc + val.size, 0);
            let startAngle = 0;
            let tooltipToDraw = null;

            chartData.forEach((slice, index) => {
                const sliceAngle = (slice.size / total) * Math.PI * 2;
                const isHovered = hoveredIndex === index;

                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, canvas.height / 2);
                
                // Radius adjustment for "Bigger" look and hover pop
                const radius = isHovered ? (canvas.width / 2) : (canvas.width / 2) - 15;
                
                ctx.arc(canvas.width / 2, canvas.height / 2, radius, startAngle, startAngle + sliceAngle);
                ctx.closePath();

                ctx.fillStyle = slice.color;
                
                if (isHovered) {
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = "rgba(0,0,0,0.2)";
                    tooltipToDraw = `${slice.label}: $${slice.size}`;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fill();
                startAngle += sliceAngle;
            });

            // Draw tooltip last so it's always on top
            if (tooltipToDraw) drawTooltip(tooltipToDraw, mousePos.x, mousePos.y);
        }

        function updateLegend() {
            legend.innerHTML = "";
            const total = chartData.reduce((acc, val) => acc + val.size, 0);
            chartData.forEach(slice => {
                const li = document.createElement("li");
                // Added the <span> back in for the color indicators
                li.innerHTML = `<span style="background:${slice.color}; display:inline-block; width:12px; height:12px; border-radius:50%; margin-right:10px;"></span> ${slice.label} (${((slice.size/total)*100).toFixed(1)}%)`;
                legend.appendChild(li);
            });
        }

        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;
            
            mousePos = { x: canvasX, y: canvasY };
            
            const x = canvasX - canvas.width / 2;
            const y = canvasY - canvas.height / 2;
            
            let angle = Math.atan2(y, x);
            if (angle < 0) angle += Math.PI * 2;

            const total = chartData.reduce((acc, val) => acc + val.size, 0);
            let currentAngle = 0;
            let newHover = null;
            
            chartData.forEach((slice, index) => {
                const sliceAngle = (slice.size / total) * Math.PI * 2;
                if (angle >= currentAngle && angle <= currentAngle + sliceAngle) {
                    newHover = index;
                }
                currentAngle += sliceAngle;
            });
            
            if (hoveredIndex !== newHover) {
                hoveredIndex = newHover;
                draw();
            }
        });

        canvas.addEventListener("mouseleave", () => { 
            hoveredIndex = null; 
            draw(); 
        });

        updateLegend();
        draw();
    }

    // 3. Launch both charts
    initPieChart("pie-chart", "pie-chart-legend", mainBudgetData);
    initPieChart("spending-chart", "spending-chart-legend", spendingData);
});
>>>>>>> Stashed changes
