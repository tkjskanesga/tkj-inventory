import { API_URL } from './state.js';
import { showNotification, createEmptyState } from './utils.js';

let classBorrowalsChart = null;
let currentLoansChart = null;
let loanHistoryChart = null;
let eventListenersInitialized = false;

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

// Fungsi untuk mengambil dan merender data penggunaan disk
const renderDiskUsage = async () => {
    const indicator = document.getElementById('diskUsageIndicator');
    if (!indicator) return;

    try {
        const response = await fetch(`${API_URL}?action=get_disk_usage`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const { used_percentage, formatted_used, formatted_free, formatted_total } = result.data;
            
            const usedBar = indicator.querySelector('.disk-bar__used');
            const freeBar = indicator.querySelector('.disk-bar__free');

            // Elemen untuk tooltip
            const usedValueTooltip = indicator.querySelector('#diskUsedValue');
            const freeValueTooltip = indicator.querySelector('#diskFreeValue');
            
            const totalText = indicator.querySelector('#diskTotalText');
            const usedText = indicator.querySelector('#diskUsedText');
            const freeText = indicator.querySelector('#diskFreeText');
            
            if (usedBar && freeBar && usedValueTooltip && freeValueTooltip && totalText && usedText && freeText) {
                const free_percentage = 100 - used_percentage;
                usedBar.style.width = `${used_percentage}%`;
                freeBar.style.width = `${free_percentage}%`;
                
                // Isi data ke tooltip
                usedValueTooltip.textContent = formatted_used;
                freeValueTooltip.textContent = formatted_free;

                // Isi data ke teks di sekitar bar
                totalText.textContent = formatted_total;
                usedText.textContent = formatted_used;
                freeText.textContent = formatted_free;

                indicator.style.visibility = 'visible';
            }
        } else {
            showNotification(result.message, 'error');
            indicator.style.display = 'none'; 
        }
    } catch (error) {
        console.error('Gagal mengambil data penggunaan disk:', error);
        indicator.style.display = 'none';
    }
};

// Fungsi untuk menghasilkan warna acak yang menarik
const generateColors = (numColors) => {
    const colors = [];
    const baseColors = [
        '#4285F4', '#DB4437', '#F4B400', '#0F9D58',
        '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24',
        '#5C6BC0', '#26A69A', '#FFCA28', '#66BB6A'
    ];
    for (let i = 0; i < numColors; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
};

// Konfigurasi global untuk semua chart
const setupChartDefaults = () => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    const textColor = isDarkMode ? 'rgba(232, 234, 237, 0.8)' : '#5f6368';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = textColor;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.scale.grid.color = gridColor;
    Chart.defaults.scale.ticks.color = textColor;
};

// --- Render Functions untuk Setiap Chart ---

const renderClassBorrowalsChart = async () => {
    const container = document.getElementById('classBorrowalsChartContainer');
    const ctx = document.getElementById('classBorrowalsChart')?.getContext('2d');
    if (!ctx || !container) return;

    const data = await fetchStatsData('class_borrowals');
    if (data.length === 0) {
        container.innerHTML = createEmptyState('Data Kosong', 'Belum ada riwayat peminjaman.');
        return;
    }
    
    // Pastikan canvas ada jika sebelumnya kosong
    container.innerHTML = '<canvas id="classBorrowalsChart"></canvas>';
    const newCtx = document.getElementById('classBorrowalsChart').getContext('2d');

    const labels = data.map(d => d.label);
    const values = data.map(d => d.count);

    if (classBorrowalsChart) {
        classBorrowalsChart.destroy();
    }

    classBorrowalsChart = new Chart(newCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Peminjaman',
                data: values,
                backgroundColor: generateColors(labels.length),
                borderColor: document.documentElement.classList.contains('dark') ? '#282a2d' : '#FFFFFF',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += `${context.parsed} kali`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
};

const renderCurrentLoansChart = async (groupBy = 'name') => {
    const container = document.getElementById('currentLoansChartContainer');
    if (!container) return;
    
    const data = await fetchStatsData('current_loans', groupBy);
    if (data.length === 0) {
        if(currentLoansChart) currentLoansChart.destroy();
        container.innerHTML = createEmptyState('Data Kosong', 'Tidak ada alat yang sedang dipinjam.');
        return;
    }

    // Pastikan canvas ada jika sebelumnya kosong
    container.innerHTML = '<canvas id="currentLoansChart"></canvas>';
    const ctx = document.getElementById('currentLoansChart').getContext('2d');

    const labels = data.map(d => d.label);
    const values = data.map(d => d.count);

    if (currentLoansChart) {
        currentLoansChart.destroy();
    }

    currentLoansChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Dipinjam',
                data: values,
                backgroundColor: generateColors(1)[0],
                borderColor: generateColors(1)[0],
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: {
                title: { display: false },
                legend: { display: false }
            }
        }
    });
};

const renderLoanHistoryChart = async (groupBy = 'name') => {
    const container = document.getElementById('loanHistoryChartContainer');
    if (!container) return;

    const data = await fetchStatsData('loan_history', groupBy);
     if (data.length === 0) {
        if(loanHistoryChart) loanHistoryChart.destroy();
        container.innerHTML = createEmptyState('Data Kosong', 'Belum ada riwayat peminjaman yang tercatat.');
        return;
    }

    // Pastikan canvas ada jika sebelumnya kosong
    container.innerHTML = '<canvas id="loanHistoryChart"></canvas>';
    const ctx = document.getElementById('loanHistoryChart').getContext('2d');

    const labels = data.map(d => d.label);
    const values = data.map(d => d.count);

    if (loanHistoryChart) {
        loanHistoryChart.destroy();
    }

    loanHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frekuensi Peminjaman',
                data: values,
                fill: true,
                backgroundColor: 'rgba(37, 211, 102, 0.1)',
                borderColor: 'rgba(37, 211, 102, 1)',
                tension: 0.1,
                pointBackgroundColor: 'rgba(37, 211, 102, 1)',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            },
            plugins: {
                title: { display: false },
                legend: { display: false }
            }
        }
    });
};

const setupEventListeners = () => {
    if (eventListenersInitialized) return;

    const setupToggle = (toggleId, chartRenderFn) => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const groupBy = e.target.dataset.value;
                    toggle.querySelector('.btn.active').classList.remove('active');
                    e.target.classList.add('active');
                    chartRenderFn(groupBy);
                }
            });
        }
    };
    
    setupToggle('currentLoansFilter', renderCurrentLoansChart);
    setupToggle('loanHistoryFilter', renderLoanHistoryChart);

    // Listener untuk perubahan tema
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === "class") {
                // Tema berubah, re-render semua chart dengan warna baru
                renderAllCharts();
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    eventListenersInitialized = true;
};

const renderAllCharts = () => {
    setupChartDefaults();
    renderClassBorrowalsChart();
    
    // Ambil nilai filter yang aktif
    const currentLoansGroupBy = document.querySelector('#currentLoansFilter .btn.active')?.dataset.value || 'name';
    const loanHistoryGroupBy = document.querySelector('#loanHistoryFilter .btn.active')?.dataset.value || 'name';
    
    renderCurrentLoansChart(currentLoansGroupBy);
    renderLoanHistoryChart(loanHistoryGroupBy);
}

export const renderStatisticsPage = async () => {
    renderAllCharts();
    setupEventListeners();
    renderDiskUsage();
};