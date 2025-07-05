import React, { useRef } from 'react';
import Chart from 'chart.js/auto';
import { CategoryScale } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(CategoryScale, zoomPlugin);

const BarChartComponent = ({ data = [], labels = [], colors, title}) => {
  const chartRef = useRef(null);

  React.useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: colors,
            barPercentage: 0.8,
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: title }
            },
            x: {
              title: { display: true, text: 'Categories' }
            }
          },
          plugins: {
            legend: { display: false },
            zoom: {
              pan: { enabled: true, mode: 'x' },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
            }
          },
          maintainAspectRatio: false,
          responsive: true,
          indexAxis: 'x'
        }
      });
    }
  }, [data, labels, colors, title]);

  return (
    <div className="overflow-x-auto max-w-full flex justify-center">
  <div className="w-[400px] h-[300px] md:w-[1000px]">
    <canvas ref={chartRef} className="w-full h-full" />
  </div>
</div>
  );
};

export default BarChartComponent;