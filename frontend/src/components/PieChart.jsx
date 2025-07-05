import React, { useEffect, useRef } from 'react';
import { Chart, ArcElement, Tooltip, Legend, PieController, Title } from 'chart.js';

// Register necessary elements and controller
Chart.register(ArcElement, Tooltip, Legend, PieController, Title);

const PieChart = ({ data, labels, colors, title = '', position = 'bottom', align = 'start' }) => {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels && labels.length ? labels : ['No Data'],
        datasets: [
          {
            data: data && data.length ? data : [1],
            backgroundColor: colors && colors.length ? colors : ['#CCCCCC'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: position,
            align: align,
            labels: {
              boxWidth: 30,
              boxHeight: 20,
              padding: 12,
              font: { size: 14, weight: 'bold', family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif" },
              color: '#333',
              generateLabels: (chart) => {
                const { data } = chart;
                return data.labels.map((label, index) => ({
                  text: label,
                  fillStyle: data.datasets[0].backgroundColor[index] || '#CCCCCC',
                  hidden: chart.getDataVisibility(index) === false,
                  index,
                  lineWidth: 1,
                  strokeStyle: '#333',
                }));
              },
            },
            maxHeight: 200,
          },
          title: {
            display: !!title,
            text: title,
            font: { size: 18 },
            padding: { top: 10, bottom: 20 },
          },
        },
        layout: {
          padding: { bottom: 50 },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, labels, colors, title, position, align]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '400px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default PieChart;