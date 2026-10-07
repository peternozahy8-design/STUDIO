// Single place to override the worker URL. Empty = auto (same origin when served by the worker, else http://127.0.0.1:8787).
// You can also use ?worker=http://host:port in the page URL, or the Worker URL field on the PRODUCE tab.
window.CWIS_CONFIG = { workerUrl: '' };
