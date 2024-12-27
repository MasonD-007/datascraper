// Content script for table selection and scraping
const STYLE_ID = 'table-scraper-styles';
const existingStyle = document.getElementById(STYLE_ID);
if (existingStyle) {
    existingStyle.remove();
}

const styleElement = document.createElement('style');
styleElement.id = STYLE_ID;
styleElement.textContent = `
    .table-scraper-highlight {
        outline: 3px solid #4CAF50 !important;
        position: relative !important;
        cursor: pointer !important;
        transition: outline-color 0.3s ease !important;
    }
    .table-scraper-selected {
        outline: 3px solid #2196F3 !important;
    }
    .table-scraper-overlay {
        position: absolute !important;
        top: 0 !important;
        right: 0 !important;
        background: #4CAF50 !important;
        color: white !important;
        padding: 5px 10px !important;
        border-radius: 0 0 0 5px !important;
        font-family: Arial, sans-serif !important;
        z-index: 10000 !important;
        pointer-events: none !important;
        transition: background-color 0.3s ease !important;
    }
    .table-scraper-selected .table-scraper-overlay {
        background: #2196F3 !important;
    }
`;
document.head.appendChild(styleElement);

let isSelectionMode = false;
let selectedTableIndexes = new Set();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSelection') {
        isSelectionMode = true;
        highlightTables(true);
        sendResponse(true);
    } else if (request.action === 'stopSelection') {
        isSelectionMode = false;
        removeHighlights();
        selectedTableIndexes.clear();
        sendResponse(true);
    } else if (request.action === 'scrapeSelected') {
        const selectedTables = document.querySelectorAll('.table-scraper-selected');
        const result = scrapeTables(selectedTables);
        sendResponse(result);
    } else if (request.action === 'getState') {
        sendResponse({
            isSelectionMode: isSelectionMode,
            hasSelectedTables: selectedTableIndexes.size > 0
        });
    }
    return true;
});

function highlightTables(restorePrevious = false) {
    removeHighlights(false);
    const tables = document.getElementsByTagName('table');
    
    if (tables.length === 0) {
        console.log('No tables found on the page');
        return;
    }

    Array.from(tables).forEach((table, index) => {
        table.style.position = 'relative';
        table.classList.add('table-scraper-highlight');
        
        if (restorePrevious && selectedTableIndexes.has(index)) {
            table.classList.add('table-scraper-selected');
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'table-scraper-overlay';
        overlay.textContent = `Table ${index + 1}`;
        table.appendChild(overlay);
        
        if (table.classList.contains('table-scraper-selected')) {
            overlay.style.backgroundColor = '#2196F3';
        }
        
        table.addEventListener('click', handleTableClick);
    });
}

function removeHighlights(clearSelections = true) {
    const highlightedTables = document.querySelectorAll('.table-scraper-highlight');
    highlightedTables.forEach(table => {
        if (clearSelections) {
            table.classList.remove('table-scraper-highlight', 'table-scraper-selected');
            selectedTableIndexes.clear();
        } else {
            table.classList.remove('table-scraper-highlight');
        }
        const overlay = table.querySelector('.table-scraper-overlay');
        if (overlay) {
            overlay.remove();
        }
        table.removeEventListener('click', handleTableClick);
    });
}

function handleTableClick(event) {
    if (!isSelectionMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const table = event.currentTarget;
    const tables = document.getElementsByTagName('table');
    const index = Array.from(tables).indexOf(table);
    
    table.classList.toggle('table-scraper-selected');
    
    if (table.classList.contains('table-scraper-selected')) {
        selectedTableIndexes.add(index);
    } else {
        selectedTableIndexes.delete(index);
    }
    
    const overlay = table.querySelector('.table-scraper-overlay');
    if (overlay) {
        overlay.style.backgroundColor = table.classList.contains('table-scraper-selected') ? '#2196F3' : '#4CAF50';
    }
}

function scrapeTables(tables) {
    try {
        if (!tables || tables.length === 0) {
            console.warn('No tables selected for scraping');
            return { tables: [] };
        }

        const scrapedTables = [];
        
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length <= 1) continue;
            
            const tableData = {
                headers: [],
                rows: []
            };

            // Get headers
            const headerCells = rows[0].querySelectorAll('td, th');
            tableData.headers = Array.from(headerCells).map(cell => cell.textContent.trim());

            // Get all rows
            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                const rowData = Array.from(cells).map(cell => cell.textContent.trim());
                if (rowData.some(text => text)) { // Skip empty rows
                    tableData.rows.push(rowData);
                }
            }
            
            if (tableData.rows.length > 0) {
                scrapedTables.push(tableData);
            }
        }
        
        return { tables: scrapedTables };
    } catch (error) {
        console.error('Error in scrapeTables:', error);
        return { tables: [] };
    }
}