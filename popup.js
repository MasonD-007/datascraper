// Check initial state when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getState' });
      if (response.isSelectionMode || response.hasSelectedTables) {
        // Restore selection mode UI if there are selected tables
        document.getElementById('initialState').style.display = 'none';
        document.getElementById('selectionMode').classList.add('active');
        
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Click on tables to select them';
        statusElement.style.color = '#666';
      }
    } catch (error) {
      console.log('Content script not ready yet:', error);
    }
  } catch (error) {
    console.error('Error checking initial state:', error);
  }
});

// Selection mode handling
document.getElementById('selectButton').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }

    // Inject the content script if it hasn't been injected yet
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script already injected or injection failed:', error);
      // Continue anyway as the script might already be injected
    }

    // Enter selection mode
    document.getElementById('initialState').style.display = 'none';
    document.getElementById('selectionMode').classList.add('active');
    
    // Start table highlighting with timeout to ensure content script is ready
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
        
        // Update status
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Click on tables to select them';
        statusElement.style.color = '#666';
      } catch (error) {
        console.error('Error in delayed start:', error);
        document.getElementById('status').textContent = 'Error: Could not start selection mode. Please refresh the page and try again.';
        document.getElementById('status').style.color = '#f44336';
      }
    }, 100);
  } catch (error) {
    console.error('Error starting selection mode:', error);
    document.getElementById('status').textContent = 'Error: Could not start selection mode';
    document.getElementById('status').style.color = '#f44336';
  }
});

document.getElementById('cancelButton').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }

    // Exit selection mode
    document.getElementById('initialState').style.display = 'block';
    document.getElementById('selectionMode').classList.remove('active');
    
    try {
      // Remove highlights
      await chrome.tabs.sendMessage(tab.id, { action: 'stopSelection' });
    } catch (error) {
      console.log('Error stopping selection, content script might be inactive:', error);
    }
    
    // Clear status
    document.getElementById('status').textContent = '';
  } catch (error) {
    console.error('Error canceling selection mode:', error);
  }
});

document.getElementById('scrapeButton').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Scraping tables...';
        statusElement.style.color = '#666';

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeSelected' });
        console.log('Scrape response:', response);
        
        if (response && response.tables && response.tables.length > 0) {
            // Store the scraped data
            storeScrapedData(response.tables, tab.url);
            
            statusElement.textContent = 'Selected tables copied and stored!';
            statusElement.style.color = '#4CAF50';
            
            // Exit selection mode
            document.getElementById('initialState').style.display = 'block';
            document.getElementById('selectionMode').classList.remove('active');
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopSelection' });
            } catch (error) {
                console.log('Error stopping selection after scrape:', error);
            }
        } else {
            statusElement.textContent = 'Please select at least one table';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Error scraping tables:', error);
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Error: ' + (error.message || 'Could not scrape tables. Please refresh the page and try again.');
        statusElement.style.color = '#f44336';
    }
});

// Add event listeners for txt and html scrape buttons
document.getElementById('scrapeTxtButton').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Scraping TXT tables...';
        statusElement.style.color = '#666';

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeTxt' });
        console.log('TXT Scrape response:', response);
        
        if (response && response.tables && response.tables.length > 0) {
            // Store the scraped data
            storeScrapedData(response.tables, tab.url);
            
            statusElement.textContent = 'TXT tables copied and stored!';
            statusElement.style.color = '#4CAF50';
            
            // Exit selection mode
            document.getElementById('initialState').style.display = 'block';
            document.getElementById('selectionMode').classList.remove('active');
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopSelection' });
            } catch (error) {
                console.log('Error stopping selection after scrape:', error);
            }
        } else {
            statusElement.textContent = 'No TXT tables found';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Error scraping TXT tables:', error);
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Error: ' + (error.message || 'Could not scrape TXT tables. Please refresh the page and try again.');
        statusElement.style.color = '#f44336';
    }
});

document.getElementById('scrapeHtmlButton').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Scraping HTML tables...';
        statusElement.style.color = '#666';

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeHtml' });
        console.log('HTML Scrape response:', response);
        
        if (response && response.tables && response.tables.length > 0) {
            // Store the scraped data
            storeScrapedData(response.tables, tab.url);
            
            statusElement.textContent = 'HTML tables copied and stored!';
            statusElement.style.color = '#4CAF50';
            
            // Exit selection mode
            document.getElementById('initialState').style.display = 'block';
            document.getElementById('selectionMode').classList.remove('active');
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopSelection' });
            } catch (error) {
                console.log('Error stopping selection after scrape:', error);
            }
        } else {
            statusElement.textContent = 'No HTML tables found';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Error scraping HTML tables:', error);
        const statusElement = document.getElementById('status');
        statusElement.textContent = 'Error: ' + (error.message || 'Could not scrape HTML tables. Please refresh the page and try again.');
        statusElement.style.color = '#f44336';
    }
});

document.getElementById('viewData').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('website/index.html'), '_blank');
});

function storeScrapedData(tables, source) {
    try {
        const storedData = localStorage.getItem('scrapedTables') || '[]';
        const existingTables = JSON.parse(storedData);
        
        const formattedTables = tables.map(table => {
            return {
                timestamp: new Date().toLocaleString(),
                source: source || 'Unknown',
                headers: table.headers || [],
                rows: table.rows || []
            };
        });
        
        existingTables.push(...formattedTables);
        localStorage.setItem('scrapedTables', JSON.stringify(existingTables));
    } catch (error) {
        console.error('Error storing scraped data:', error);
        throw new Error('Failed to store scraped data');
    }
} 