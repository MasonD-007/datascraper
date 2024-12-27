// Make copyColumn available globally
window.copyColumn = async function(tableIndex, columnIndex) {
    try {
        const table = document.querySelector(`.table-entry[data-table-index="${tableIndex}"] table`);
        if (!table) {
            throw new Error('Table not found');
        }

        // Get only visible rows (not filtered out or hidden)
        const visibleRows = Array.from(table.querySelectorAll('tbody tr')).filter(row => 
            window.getComputedStyle(row).display !== 'none'
        );

        // Extract text from the correct column of visible rows
        const values = visibleRows.map(row => {
            const cell = row.cells[parseInt(columnIndex) + 1]; // +1 for checkbox column
            return cell ? cell.textContent.trim() : '';
        }).filter(text => text); // Remove empty values

        if (values.length === 0) {
            throw new Error('No visible data to copy');
        }

        await navigator.clipboard.writeText(values.join('\n'));
        
        // Visual feedback
        const button = document.querySelector(`.copy-column[data-table-index="${tableIndex}"][data-column-index="${columnIndex}"]`);
        if (button) {
            button.textContent = 'Copied!';
            button.style.background = '#4CAF50';
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '#2196F3';
            }, 1500);
        }
    } catch (error) {
        console.error('Failed to copy:', error);
        const button = document.querySelector(`.copy-column[data-table-index="${tableIndex}"][data-column-index="${columnIndex}"]`);
        if (button) {
            button.textContent = 'Failed to copy';
            button.style.background = '#dc3545';
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '#2196F3';
            }, 1500);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStoredData();
    
    document.getElementById('clearData').addEventListener('click', clearAllData);
    document.getElementById('deleteSelected').addEventListener('click', deleteSelectedRows);

    // Add event listener for filter inputs
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('column-filter')) {
            const tableIndex = e.target.dataset.tableIndex;
            const columnIndex = e.target.dataset.columnIndex;
            filterTable(tableIndex, columnIndex, e.target.value);
        }
    });

    // Add event listener for copy column buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-column')) {
            const tableIndex = e.target.dataset.tableIndex;
            const columnIndex = e.target.dataset.columnIndex;
            window.copyColumn(tableIndex, columnIndex);
        }
    });
});

function loadStoredData() {
    const storedData = localStorage.getItem('scrapedTables');
    const dataList = document.getElementById('dataList');
    
    if (!storedData) {
        dataList.innerHTML = '<div class="no-data">No scraped data available</div>';
        return;
    }
    
    try {
        const tables = JSON.parse(storedData);
        if (!Array.isArray(tables)) {
            throw new Error('Stored data is not an array');
        }

        let html = '';
        
        tables.forEach((table, tableIndex) => {
            if (!table.headers || !table.rows) {
                console.warn(`Table ${tableIndex} is missing headers or rows`);
                return;
            }

            html += `
                <div class="table-entry" data-table-index="${tableIndex}">
                    <h3>Scraped Table ${tableIndex + 1}</h3>
                    <p class="timestamp">Scraped on: ${table.timestamp || 'Unknown'}</p>
                    <p class="source">Source: ${table.source || 'Unknown'}</p>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th class="select-cell">
                                        <input type="checkbox" class="select-all-rows" data-table-index="${tableIndex}">
                                    </th>
                                    ${Array.isArray(table.headers) ? table.headers.map((header, colIndex) => `
                                        <th>
                                            <div class="column-header">
                                                <span>${header || ''}</span>
                                                <button class="copy-column" data-table-index="${tableIndex}" data-column-index="${colIndex}">
                                                    Copy
                                                </button>
                                            </div>
                                            <input type="text" class="column-filter" placeholder="Filter ${header}..." 
                                                data-table-index="${tableIndex}" data-column-index="${colIndex}">
                                        </th>
                                    `).join('') : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(table.rows) ? table.rows.map((row, rowIndex) => `
                                    <tr class="data-row">
                                        <td class="select-cell">
                                            <input type="checkbox" class="select-row" data-table-index="${tableIndex}" data-row-index="${rowIndex}">
                                        </td>
                                        ${Array.isArray(row) ? row.map(cell => 
                                            `<td>${cell || ''}</td>`
                                        ).join('') : ''}
                                    </tr>
                                `).join('') : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        if (html) {
            dataList.innerHTML = html;
            
            // Add event listeners for checkboxes
            document.querySelectorAll('.select-all-rows').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const tableIndex = e.target.dataset.tableIndex;
                    const rows = document.querySelectorAll(`input.select-row[data-table-index="${tableIndex}"]`);
                    rows.forEach(row => row.checked = e.target.checked);
                });
            });
        } else {
            dataList.innerHTML = '<div class="no-data">No valid tables found</div>';
        }
    } catch (error) {
        console.error('Error loading stored data:', error);
        dataList.innerHTML = '<div class="no-data">Error loading stored data: ' + error.message + '</div>';
    }
}

function filterTable(tableIndex, columnIndex, filterValue) {
    const table = document.querySelector(`.table-entry[data-table-index="${tableIndex}"] table`);
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cell = row.cells[parseInt(columnIndex) + 1]; // +1 for checkbox column
        if (cell) {
            const text = cell.textContent.toLowerCase();
            const filter = filterValue.toLowerCase();
            row.style.display = text.includes(filter) ? '' : 'none';
        }
    });
}

function deleteSelectedRows() {
    const storedData = localStorage.getItem('scrapedTables');
    if (!storedData) return;
    
    try {
        const tables = JSON.parse(storedData);
        const selectedRows = document.querySelectorAll('.select-row:checked');
        
        // Group selected rows by table
        const deletions = new Map();
        selectedRows.forEach(checkbox => {
            const tableIndex = parseInt(checkbox.dataset.tableIndex);
            const rowIndex = parseInt(checkbox.dataset.rowIndex);
            
            if (!deletions.has(tableIndex)) {
                deletions.set(tableIndex, new Set());
            }
            deletions.get(tableIndex).add(rowIndex);
        });
        
        // Remove selected rows from each table
        deletions.forEach((rowIndices, tableIndex) => {
            const rowIndexArray = Array.from(rowIndices).sort((a, b) => b - a);
            rowIndexArray.forEach(rowIndex => {
                tables[tableIndex].rows.splice(rowIndex, 1);
            });
        });
        
        // Remove empty tables
        const nonEmptyTables = tables.filter(table => table.rows.length > 0);
        
        // Save updated data
        localStorage.setItem('scrapedTables', JSON.stringify(nonEmptyTables));
        
        // Reload the view
        loadStoredData();
    } catch (error) {
        console.error('Error deleting rows:', error);
    }
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all stored data?')) {
        localStorage.removeItem('scrapedTables');
        loadStoredData();
    }
} 