import { API_URL } from '../state.js';
import { handleFetchError } from '../api.js';

export const processJobQueue = async (processEndpoint, uiUpdateFunction, errorContext) => {
    try {
        const response = await fetch(`${API_URL}?action=${processEndpoint}`);
        
        if (response.status === 429) {
            setTimeout(() => processJobQueue(processEndpoint, uiUpdateFunction, errorContext), 1000);
            return;
        }

        const result = await response.json();

        if (result.status === 'error' && !result.jobs) {
            uiUpdateFunction({ status: 'error', message: result.message });
            return;
        }

        uiUpdateFunction(result);

        if (result.status === 'running' || result.status === 'finalizing') {
            const delay = (result.status === 'finalizing' || errorContext === 'import') ? 200 : 100;
            setTimeout(() => processJobQueue(processEndpoint, uiUpdateFunction, errorContext), delay);
        }
    } catch (error) {
        handleFetchError(error, `Gagal memproses antrian ${errorContext}.`);
        uiUpdateFunction({ status: 'error', message: `Koneksi ke server ${errorContext} terputus.` });
    }
};

export const createStatusPoller = (statusGetFunction, uiUpdateFunction, interval = 2000) => {
    let timerId = null;
    let isStopped = false;

    const runCheck = async () => {
        if (isStopped) return;

        try {
            const data = await statusGetFunction();
            if (isStopped) return;

            uiUpdateFunction(data);

            if (data.status === 'running' || data.status === 'pending') {
                timerId = setTimeout(runCheck, interval);
            }
        } catch (error) {
            console.error('Polling status gagal:', error);
            if (!isStopped) {
                timerId = setTimeout(runCheck, interval * 2);
            }
        }
    };

    return {
        start: () => {
            if (timerId) return;
            isStopped = false;
            runCheck();
        },
        stop: () => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
            isStopped = true;
        }
    };
};