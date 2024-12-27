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
    // For .txt files, we need to find tables in the text content
    if (window.location.pathname.endsWith('.txt')) {
        const pageText = document.body.innerText;
        const tableRegex = /<TABLE>[\s\S]*?<\/TABLE>/gi;
        const matches = pageText.match(tableRegex);
        
        if (!matches) {
            console.log('No tables found in .txt file');
            return { tables: [] };
        }

        const scrapedTables = matches.map((tableText, tableIndex) => {
            // Split the table text into rows
            const rows = tableText
                .replace(/<TABLE>|<\/TABLE>/gi, '')
                .split('\n')
                .map(row => row.trim())
                .filter(row => row); // Keep all non-empty rows initially

            if (rows.length === 0) return null;

            // Find the first header row (row after a separator)
            let headerIndex = -1;
            for (let i = 0; i < rows.length - 1; i++) {
                if (/^[-=\s]+$/.test(rows[i])) {
                    headerIndex = i + 1;
                    break;
                }
            }

            if (headerIndex === -1 || headerIndex >= rows.length) {
                console.log('No valid header row found after separator');
                return null;
            }

            // Extract headers from the row after the separator
            const headers = rows[headerIndex]
                .split(/\s+/)
                .filter(header => header)
                .map(header => header.trim());
            
            // Process remaining rows
            const dataRows = rows.slice(headerIndex + 1).map(row => {
                // Split by whitespace and remove empty cells
                return row
                    .split(/\s+/)
                    .filter(cell => cell)
                    .map(cell => cell.trim());
            }).filter(row => {
                // Remove empty rows and rows that are separators
                return row.length > 0 && !row.every(cell => /^[-=\s]+$/.test(cell));
            });

            return {
                headers: headers,
                rows: dataRows
            };
        }).filter(table => table !== null);

        return { tables: scrapedTables };
    }

    // For regular HTML tables
    if (!tables || tables.length === 0) {
        console.log('No tables selected');
        return { tables: [] };
    }

    const scrapedTables = Array.from(tables).map(table => {
        // Get headers
        const headerRow = table.querySelector('tr');
        const headers = headerRow ? Array.from(headerRow.cells).map(cell => cell.textContent.trim()) : [];

        // Get data rows
        const rows = Array.from(table.querySelectorAll('tr')).slice(1).map(row => {
            return Array.from(row.cells).map(cell => cell.textContent.trim());
        });

        return {
            headers: headers,
            rows: rows
        };
    });

    return { tables: scrapedTables };
}

// Handle table selection
let selectedTables = new Set();

function toggleTableSelection(table) {
    if (selectedTables.has(table)) {
        selectedTables.delete(table);
        table.classList.remove('table-selected');
    } else {
        selectedTables.add(table);
        table.classList.add('table-selected');
    }
}

// Add click handlers to tables
document.addEventListener('click', (e) => {
    const table = e.target.closest('table');
    if (table) {
        toggleTableSelection(table);
    }
});

// Add hover effect
document.addEventListener('mouseover', (e) => {
    const table = e.target.closest('table');
    if (table) {
        table.classList.add('table-hover');
    }
});

document.addEventListener('mouseout', (e) => {
    const table = e.target.closest('table');
    if (table) {
        table.classList.remove('table-hover');
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSelectedTables') {
        const result = scrapeTables(selectedTables);
        sendResponse(result);
    }
});