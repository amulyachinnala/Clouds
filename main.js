document.addEventListener("DOMContentLoaded", () => {
 
  const chartData = [
    { label: "Savings", size: 250, color: '#f5c71a' }, 
    { label: "Spending Money", size: 500, color: '#ffffe0' },
    { label: "Fixed Expenses", size: 250, color: '#fff44f' }   
  ];

  const canvas = document.getElementById("pie-chart");
  const ctx = canvas.getContext("2d");
  const legend = document.getElementById("pie-chart-legend");
  
  let hoveredIndex = null;

  function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const total = chartData.reduce((acc, val) => acc + val.size, 0);
    let startAngle = 0;

    chartData.forEach((slice, index) => {
      const sliceAngle = (slice.size / total) * Math.PI * 2;
      const isHovered = hoveredIndex === index;

      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      
      // If hovered, slightly increase the radius to "pop" it out
      const radius = isHovered ? (canvas.width / 2) : (canvas.width / 2) - 10;
      
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        radius,
        startAngle,
        startAngle + sliceAngle
      );
      ctx.closePath();

      // Adjust color on hover (slightly lighter/darker)
      ctx.fillStyle = slice.color;
      if (isHovered) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = "rgba(0,0,0,0.2)";
      } else {
          ctx.shadowBlur = 0;
      }
      
      ctx.fill();
      startAngle += sliceAngle;
    });
  }

  // Generate Legend once
  function updateLegend() {
    legend.innerHTML = "";
    const total = chartData.reduce((acc, val) => acc + val.size, 0);
    chartData.forEach((slice) => {
      const li = document.createElement("li");
      li.innerHTML = `<span style="background-color:${slice.color};"></span> ${slice.label} (${((slice.size/total)*100).toFixed(1)}%)`;
      legend.appendChild(li);
    });
  }

  // --- 2. HOVER LOGIC ---
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / (2 * (rect.width/canvas.width));
    const y = e.clientY - rect.top - canvas.height / (2 * (rect.height/canvas.height));
    
    // Calculate angle from center
    let angle = Math.atan2(y, x);
    if (angle < 0) angle += Math.PI * 2;

    // Determine which slice the angle belongs to
    const total = chartData.reduce((acc, val) => acc + val.size, 0);
    let currentAngle = 0;
    let newHoveredIndex = null;

    chartData.forEach((slice, index) => {
      const sliceAngle = (slice.size / total) * Math.PI * 2;
      if (angle >= currentAngle && angle <= currentAngle + sliceAngle) {
        newHoveredIndex = index;
      }
      currentAngle += sliceAngle;
    });

    if (hoveredIndex !== newHoveredIndex) {
      hoveredIndex = newHoveredIndex;
      drawChart(); // Redraw only if the hover state changed
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hoveredIndex = null;
    drawChart();
  });

  // Initial Run
  updateLegend();
  drawChart();
});