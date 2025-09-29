import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

interface StoredImage {
    id: string;
    original: ArrayBuffer;
    processed: ArrayBuffer;
    timestamp: number;
    fileName?: string;
}

function App() {
    const [image, setImage] = useState<File | null>(null);
    const [processedImage, setProcessedImage] = useState<null | string>(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<StoredImage[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadHistoryFromDB();
    }, []);

    // Конвертация ArrayBuffer в Blob URL
    const arrayBufferToBlobUrl = (buffer: ArrayBuffer, type: string = 'image/jpeg'): string => {
        const blob = new Blob([buffer], { type });
        return URL.createObjectURL(blob);
    };

    // Конвертация File в ArrayBuffer
    const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const initDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ImageDetectionDB', 2);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('images')) {
                    const store = db.createObjectStore('images', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    };

    const saveImageToDB = async (originalFile: File, processedBlob: Blob) => {
        try {
            const db = await initDB();

            const [originalBuffer, processedBuffer] = await Promise.all([
                fileToArrayBuffer(originalFile),
                fileToArrayBuffer(new File([processedBlob], 'processed.jpg'))
            ]);

            const imageData: StoredImage = {
                id: Date.now().toString(),
                original: originalBuffer,
                processed: processedBuffer,
                timestamp: Date.now(),
                fileName: originalFile.name
            };

            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.add(imageData);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
                transaction.oncomplete = () => resolve();
            });

            const newHistory = [imageData, ...history].slice(0, 5);
            setHistory(newHistory);

        } catch (error) {
            console.error('Error saving to DB:', error);
        }
    };

    const loadHistoryFromDB = async () => {
        try {
            const db = await initDB();
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const index = store.index('timestamp');

            const images: StoredImage[] = await new Promise((resolve, reject) => {
                const request = index.openCursor(null, 'prev');
                const results: StoredImage[] = [];

                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        results.push(cursor.value);
                        if (results.length < 5) {
                            cursor.continue();
                        } else {
                            resolve(results);
                        }
                    } else {
                        resolve(results);
                    }
                };

                request.onerror = () => reject(request.error);
            });

            setHistory(images);

        } catch (error) {
            console.error('Error loading from DB:', error);
        }
    };

    const getStoredImageUrl = (storedImage: StoredImage, type: 'original' | 'processed'): string => {
        return arrayBufferToBlobUrl(storedImage[type]);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setProcessedImage(null);
        }
    };

    const processImage = async () => {
        if (!image) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', image);

        try {
            const response = await axios.post('https://brehtdetector.ru/predict', formData, {
                responseType: 'blob'
            });

            const processedBlob = response.data;
            const processedUrl = URL.createObjectURL(processedBlob);

            setProcessedImage(processedUrl);
            await saveImageToDB(image, processedBlob);

        } catch (error) {
            console.error('Error processing image:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setImage(file);
            setProcessedImage(null);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const triggerCameraInput = () => {
        cameraInputRef.current?.click();
    };

    const loadFromHistory = (storedImage: StoredImage) => {
        const processedUrl = getStoredImageUrl(storedImage, 'processed');
        const file = new File([new Blob([storedImage.original])], storedImage.fileName || 'image.jpg', {
            type: 'image/jpeg'
        });

        setImage(file);
        setProcessedImage(processedUrl);
        setShowHistory(false);
    };

    const clearImages = () => {
        setImage(null);
        setProcessedImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const getImageSource = (file: File) => {
        return URL.createObjectURL(file);
    };

    const clearHistory = async () => {
        try {
            const db = await initDB();
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            setHistory([]);
            setShowHistory(false);
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    const deleteFromHistory = async (id: string, event: React.MouseEvent) => {
        event.stopPropagation();

        try {
            const db = await initDB();
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            const newHistory = history.filter(item => item.id !== id);
            setHistory(newHistory);

        } catch (error) {
            console.error('Error deleting from history:', error);
        }
    };

    // Очистка blob URLs при размонтировании
    useEffect(() => {
        return () => {
            history.forEach(storedImage => {
                URL.revokeObjectURL(getStoredImageUrl(storedImage, 'original'));
                URL.revokeObjectURL(getStoredImageUrl(storedImage, 'processed'));
            });
            if (processedImage) URL.revokeObjectURL(processedImage);
            if (image) URL.revokeObjectURL(getImageSource(image));
        };
    }, [history, processedImage, image]);

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <h1 className="title">Распознавание дефектов</h1>
                    <p className="subtitle">Загрузите изображение для того чтобы распознать дефекты</p>
                </div>

                {history.length > 0 && (
                    <div className="header-actions">
                        <button
                            className="history-btn"
                            onClick={() => setShowHistory(!showHistory)}
                        >
                            История ({history.length})
                        </button>
                    </div>
                )}
            </header>

            <main className="main-content">
                {/* Upload Section */}
                <section className="upload-section">
                    <div className="upload-area">
                        {/* Мобильные кнопки */}
                        <div className="mobile-buttons">
                            <button className="upload-btn camera" onClick={triggerCameraInput}>
                                📷 Сделать фото
                            </button>
                            <button className="upload-btn gallery" onClick={triggerFileInput}>
                                🖼️ Выбрать из галереи
                            </button>
                        </div>

                        {/* Десктопная область загрузки */}
                        <div
                            className="desktop-upload-area"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={triggerFileInput}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden-input"
                            />
                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageUpload}
                                className="hidden-input"
                            />

                            {image ? (
                                <div className="image-preview">
                                    <img src={getImageSource(image)} alt="Preview" />
                                    <div className="image-info">
                                        <span>{image.name}</span>
                                        <span>{(image.size / (1024 * 1024)).toFixed(2)} MB</span>
                                    </div>
                                    <button
                                        className="change-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            triggerFileInput();
                                        }}
                                    >
                                        Изменить
                                    </button>
                                </div>
                            ) : (
                                <div className="upload-placeholder">
                                    <div className="upload-icon">📁</div>
                                    <p>Нажмите или перетащите изображение</p>
                                    <span>Поддерживаются JPG, PNG, WebP</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Кнопки действий */}
                    {image && (
                        <div className="action-buttons">
                            <button
                                className={`process-btn ${loading ? 'loading' : ''}`}
                                onClick={processImage}
                                disabled={loading}
                            >
                                {loading ? 'Обработка...' : 'Обнаружить объекты'}
                            </button>
                            <button className="clear-btn" onClick={clearImages}>
                                Очистить
                            </button>
                        </div>
                    )}
                </section>

                {/* Results Section */}
                {(image || processedImage) && (
                    <section className="results-section">
                        <h2>Результаты обнаружения</h2>
                        <div className="results-grid">
                            {image && (
                                <div className="result-card">
                                    <h3>Исходное изображение</h3>
                                    <div className="image-container">
                                        <img src={getImageSource(image)} alt="Original" />
                                    </div>
                                </div>
                            )}

                            {processedImage && (
                                <div className="result-card">
                                    <h3>Результат</h3>
                                    <div className="image-container">
                                        <img src={processedImage} alt="Processed" />
                                    </div>
                                    <div className="result-actions">
                                        <a
                                            href={processedImage}
                                            download={`detected-${Date.now()}.jpg`}
                                            className="download-btn"
                                        >
                                            📥 Скачать результат
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>

            {/* History Panel */}
            {showHistory && (
                <div className="history-overlay">
                    <div className="history-panel">
                        <div className="history-header">
                            <h3>История изображений</h3>
                            <div className="history-actions">
                                <button className="clear-history" onClick={clearHistory}>
                                    Очистить все
                                </button>
                                <button className="close-btn" onClick={() => setShowHistory(false)}>
                                    ✕
                                </button>
                            </div>
                        </div>

                        {history.length === 0 ? (
                            <div className="empty-history">
                                <p>История пуста</p>
                            </div>
                        ) : (
                            <div className="history-grid">
                                {history.map((storedImage) => (
                                    <div
                                        key={storedImage.id}
                                        className="history-item"
                                        onClick={() => loadFromHistory(storedImage)}
                                    >
                                        <div className="history-image">
                                            <img
                                                src={getStoredImageUrl(storedImage, 'processed')}
                                                alt="Processed"
                                            />
                                        </div>
                                        <div className="history-info">
                                            <span className="history-time">
                                                {new Date(storedImage.timestamp).toLocaleDateString()}
                                            </span>
                                            <button
                                                className="delete-btn"
                                                onClick={(e) => deleteFromHistory(storedImage.id, e)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;