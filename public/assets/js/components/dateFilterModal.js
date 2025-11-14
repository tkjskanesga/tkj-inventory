import { state } from '../state.js';
import { openModal, closeModal, toLocalDateString } from '../utils.js';
import { fetchAndRenderHistory } from '../api.js';
import { renderReturns } from '../render.js';
import { updateFabFilterState } from '../ui.js';

/**
 * Menampilkan modal kalender untuk memfilter berdasarkan tanggal.
 */
export const showDateFilterModal = () => {
    let displayDate = state.selectedDate ? new Date(state.selectedDate) : new Date();
    let tempSelectedDate = state.selectedDate ? new Date(state.selectedDate) : null;

    const renderCalendar = () => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        
        const monthOptions = monthNames.map((m, i) => `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`).join('');
        
        const currentYear = new Date().getFullYear();
        let yearOptions = '';
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            yearOptions += `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`;
        }

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        let calendarGrid = '';
        for (let i = 0; i < firstDay; i++) {
            calendarGrid += `<div class="calendar-day is-empty"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const thisDate = new Date(year, month, day);
            let classes = 'calendar-day';
            if (toLocalDateString(thisDate) === toLocalDateString(today)) classes += ' is-today';
            if (tempSelectedDate && toLocalDateString(thisDate) === toLocalDateString(tempSelectedDate)) classes += ' is-selected';
            calendarGrid += `<div class="${classes}" data-date="${thisDate.toISOString()}">${day}</div>`;
        }
        
        openModal('Filter Tanggal', `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-header__nav" id="cal-prev"><i class='bx bx-chevron-left'></i></button>
                    <div class="calendar-header__title">
                        <select id="month-select" class="calendar-select">${monthOptions}</select>
                        <select id="year-select" class="calendar-select">${yearOptions}</select>
                    </div>
                    <button class="calendar-header__nav" id="cal-next"><i class='bx bx-chevron-right'></i></button>
                </div>
                <div class="calendar-grid">
                    ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                    ${calendarGrid}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Batal</button>
                <button type="button" class="btn btn-primary" id="applyDateFilterBtn">Terapkan</button>
            </div>
        `);
        
        document.getElementById('cal-prev').onclick = () => { displayDate.setMonth(month - 1); renderCalendar(); };
        document.getElementById('cal-next').onclick = () => { displayDate.setMonth(month + 1); renderCalendar(); };
        document.getElementById('month-select').onchange = (e) => { displayDate.setMonth(parseInt(e.target.value)); renderCalendar(); };
        document.getElementById('year-select').onchange = (e) => { displayDate.setFullYear(parseInt(e.target.value)); renderCalendar(); };
        
        document.querySelectorAll('.calendar-day:not(.is-empty)').forEach(el => {
            el.onclick = () => {
                tempSelectedDate = new Date(el.dataset.date);
                renderCalendar();
            };
        });
        
        document.getElementById('applyDateFilterBtn').onclick = () => {
            state.selectedDate = tempSelectedDate;
            updateFabFilterState();
            closeModal();
            
            const activePageId = document.querySelector('.page.active')?.id;
            if (activePageId === 'history') {
                fetchAndRenderHistory();
            } else if (activePageId === 'return') {
                renderReturns();
            }
        };
    };
    renderCalendar();
};