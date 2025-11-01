import { API_URL } from './state.js';
import { showNotification, createEmptyState, escapeHTML } from './utils.js';

let classBorrowalsChart = null;
let currentLoansChart = null;
let loanHistoryChart = null;
let eventListenersInitialized = false;

// Fungsi helper untuk mendeteksi perangkat mobile berdasarkan lebar layar
const isMobile = () => window.innerWidth <= 840;

// Fungsi helper untuk mengambil data statistik dari API
const fetchStatsData = async (type, groupBy = 'name') => {
    try {
        const response = await fetch(`${API_URL}?action=get_statistics&type=${type}&groupBy=${groupBy}`);
        const result = await response.json();
        if (result.status === 'success') {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showNotification(`Gagal memuat data untuk ${type}: ${error.message}`, 'error');
        return [];
    }
};

// --- Logika Tooltip Kustom ---
const getOrCreateTooltip = () => {
    let tooltipEl = document.getElementById('chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.style.opacity = 0;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
};

const externalTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip();

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    if (tooltip.body) {
        const dataPointIndex = tooltip.dataPoints[0].dataIndex;
        const chartType = chart.config.type;
        const originalData = chart.options.plugins.tooltip.externalContext.data;
        const itemData = originalData[dataPointIndex];
        
        const imageUrl = itemData.image_url;
        const label = escapeHTML(itemData.label);
        const value = itemData.count;
        
        let valueText = (chartType === 'bar') ? `Jumlah Dipinjam: ${value}` : `Frekuensi: ${value} kali`;
        
        let innerHtml = '';
        if (imageUrl) {
             const placeholder = `https://placehold.co/120x100/8ab4f8/ffffff?text=${encodeURIComponent(label)}`;
             innerHtml += `<img src="${escapeHTML(imageUrl)}" alt="${label}" class="chartjs-tooltip-image" onerror="this.onerror=null;this.src='${placeholder}';">`;
        }
        innerHtml += `<span class="chartjs-tooltip-label">${label}</span>`;
        innerHtml += `<span class="chartjs-tooltip-value">${valueText}</span>`;
        tooltipEl.innerHTML = innerHtml;
    }

    const position = chart.canvas.getBoundingClientRect();
    
    // Posisi dasar tooltip
    let left = position.left + window.scrollX + tooltip.caretX;
    const top = position.top + window.scrollY + tooltip.caretY;

    // Penyesuaian agar tidak terpotong layar
    const tooltipWidth = tooltipEl.offsetWidth;
    
    // Cek batas kanan
    if (left + tooltipWidth / 2 > window.innerWidth - 10) { // 10px buffer
        left = window.innerWidth - tooltipWidth / 2 - 10;
    }
    // Cek batas kiri
    if (left - tooltipWidth / 2 < 10) { // 10px buffer
        left = tooltipWidth / 2 + 10;
    }

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.transform = `translate(-50%, calc(-100% - 10px))`; // Geser 10px di atas kursor
};


// Fungsi untuk mengambil dan merender data penggunaan disk
const renderDiskUsage = async () => {
    const indicator = document.getElementById('diskUsageIndicator');
    if (!indicator) return;

    try {
        const response = await fetch(`${API_URL}?action=get_disk_usage`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const { used_percentage, formatted_used, formatted_free, formatted_total } = result.data;
            
            indicator.querySelector('.disk-bar__used').style.width = `${used_percentage}%`;
            indicator.querySelector('.disk-bar__free').style.width = `${100 - used_percentage}%`;
            indicator.querySelector('#diskUsedValue').textContent = formatted_used;
            indicator.querySelector('#diskFreeValue').textContent = formatted_free;
            indicator.querySelector('#diskTotalText').textContent = formatted_total;
            indicator.querySelector('#diskUsedText').textContent = formatted_used;
            indicator.querySelector('#diskFreeText').textContent = formatted_free;
            indicator.style.visibility = 'visible';
        } else {
             indicator.style.display = 'none';
        }
    } catch (error) {
        console.error('Gagal mengambil data penggunaan disk:', error);
        indicator.style.display = 'none';
    }
};

const generateColors = (numColors) => {
    const colors = [];
    const baseColors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24', '#5C6BC0', '#26A69A', '#FFCA28', '#66BB6A'];
    for (let i = 0; i < numColors; i++) colors.push(baseColors[i % baseColors.length]);
    return colors;
};

const setupChartDefaults = () => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? 'rgba(232, 234, 237, 0.8)' : '#5f6368';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = textColor;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.scale.grid.color = gridColor;
    Chart.defaults.scale.ticks.color = textColor;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.responsive = true;
};

// --- Fungsi Render ---

/**
 * Merender atau memperbarui chart tanpa menyebabkan kedipan.
 * @param {Chart} chartInstance - Instance chart yang ada atau null.
 * @param {string} containerId - ID dari div container.
 * @param {string} canvasId - ID dari elemen canvas.
 * @param {object} config - Konfigurasi Chart.js (termasuk tipe, data, opsi).
 * @returns {Chart|null} Instance chart yang baru atau yang diperbarui.
 */
const renderOrUpdateChart = (chartInstance, containerId, canvasId, config) => {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const hasData = config.data.labels && config.data.labels.length > 0;

    if (!hasData) {
        if (chartInstance) {
            chartInstance.destroy();
        }
        container.innerHTML = createEmptyState('Data Kosong', 'Belum ada data untuk ditampilkan.');
        return null;
    }

    let canvas = container.querySelector('canvas');
    if (!canvas) {
        container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
        canvas = document.getElementById(canvasId);
        chartInstance = null; // Instance lama tidak valid jika canvas dibuat ulang
    }
    
    if (chartInstance) {
        chartInstance.data = config.data;
        chartInstance.options = config.options;
        chartInstance.update();
        return chartInstance;
    } else {
        const ctx = canvas.getContext('2d');
        return new Chart(ctx, config);
    }
};

const renderClassBorrowalsChart = async () => {
    const data = await fetchStatsData('class_borrowals');
    const config = {
        type: 'pie',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Jumlah Peminjaman',
                data: data.map(d => d.count),
                backgroundColor: generateColors(data.length),
                borderColor: document.documentElement.classList.contains('dark') ? '#282a2d' : '#FFFFFF',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: { plugins: { title: { display: false } } }
    };
    classBorrowalsChart = renderOrUpdateChart(classBorrowalsChart, 'classBorrowalsChartContainer', 'classBorrowalsChart', config);
};

const renderCurrentLoansChart = async (groupBy = 'name') => {
    const data = await fetchStatsData('current_loans', groupBy);
    const config = {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Jumlah Dipinjam',
                data: data.map(d => d.count),
                backgroundColor: generateColors(1)[0],
                borderRadius: 5
            }]
        },
        options: {
            scales: { 
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { display: !isMobile() || groupBy === 'classifier' } 
            },
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: { 
                    enabled: false,
                    position: 'nearest',
                    external: externalTooltipHandler,
                    externalContext: { data }
                }
            },
            onHover: (e, el) => { e.native.target.style.cursor = el[0] ? 'pointer' : 'default'; }
        }
    };
    
    // Nonaktifkan tooltip kustom jika dikelompokkan berdasarkan jenis alat
    if (groupBy === 'classifier') {
        config.options.plugins.tooltip.enabled = true;
        config.options.plugins.tooltip.external = undefined;
        config.options.plugins.tooltip.externalContext = undefined;
    }

    currentLoansChart = renderOrUpdateChart(currentLoansChart, 'currentLoansChartContainer', 'currentLoansChart', config);
};

const renderLoanHistoryChart = async (groupBy = 'name') => {
    const data = await fetchStatsData('loan_history', groupBy);
    const config = {
        type: 'line',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Frekuensi Peminjaman',
                data: data.map(d => d.count),
                fill: true,
                backgroundColor: 'rgba(37, 211, 102, 0.1)',
                borderColor: 'rgba(37, 211, 102, 1)',
                tension: 0.1,
                pointRadius: 4
            }]
        },
        options: {
            scales: { 
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { display: !isMobile() || groupBy === 'classifier' }
            },
            plugins: {
                title: { display: false },
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    position: 'nearest',
                    external: externalTooltipHandler,
                    externalContext: { data }
                }
            },
            interaction: { intersect: false, mode: 'index' },
            onHover: (e, el) => { e.native.target.style.cursor = el[0] ? 'pointer' : 'default'; }
        }
    };
    
    if (groupBy === 'classifier') {
        config.options.plugins.tooltip.enabled = true;
        config.options.plugins.tooltip.external = undefined;
        config.options.plugins.tooltip.externalContext = undefined;
    }

    loanHistoryChart = renderOrUpdateChart(loanHistoryChart, 'loanHistoryChartContainer', 'loanHistoryChart', config);
};

const renderAllCharts = () => {
    setupChartDefaults();
    renderClassBorrowalsChart();
    
    const currentLoansGroupBy = document.querySelector('#currentLoansFilter .btn.active')?.dataset.value || 'classifier';
    const loanHistoryGroupBy = document.querySelector('#loanHistoryFilter .btn.active')?.dataset.value || 'classifier';
    
    renderCurrentLoansChart(currentLoansGroupBy);
    renderLoanHistoryChart(loanHistoryGroupBy);
};

const setupEventListeners = () => {
    if (eventListenersInitialized) return;

    const setupToggle = (toggleId, chartRenderFn) => {
        document.getElementById(toggleId)?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
                const groupBy = e.target.dataset.value;
                e.currentTarget.querySelector('.btn.active').classList.remove('active');
                e.target.classList.add('active');
                chartRenderFn(groupBy);
            }
        });
    };
    
    setupToggle('currentLoansFilter', renderCurrentLoansChart);
    setupToggle('loanHistoryFilter', renderLoanHistoryChart);

    const themeObserver = new MutationObserver((mutations) => {
        if (mutations[0].attributeName === "class") {
            setTimeout(renderAllCharts, 50);
        }
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    eventListenersInitialized = true;
};

export const renderStatisticsPage = async () => {
    renderAllCharts();
    setupEventListeners();
    renderDiskUsage();
};