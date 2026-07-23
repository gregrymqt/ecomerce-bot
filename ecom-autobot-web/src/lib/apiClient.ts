import {getTenantId } from '@/features/auth/utils/storage';
import axios from 'axios'

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, //10s
    withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
    const tenantId = getTenantId();

    if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
    }

    return config
});