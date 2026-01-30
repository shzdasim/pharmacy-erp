import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Update API endpoints
export const updateApi = {
    // Get current update status and settings
    getStatus: () => api.get('/updates/status'),
    
    // Check for new updates
    check: () => api.get('/updates/check'),
    
    // Get latest release info
    getLatest: () => api.get('/updates/latest'),
    
    // Install update
    install: (force = false) => api.post('/updates/install', { force }),
    
    // Update settings
    updateSettings: (settings) => api.put('/updates/settings', settings),
    
    // Get update logs/history
    getLogs: (limit = 50) => api.get('/updates/logs', { params: { limit } }),
};

export default api;

