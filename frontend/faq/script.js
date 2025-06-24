import { FAQ_DATA, FAQ_CATEGORIES, escapeHtml } from './faq-data.js';

document.addEventListener('DOMContentLoaded', () => {
    const faqList = document.getElementById('faq-list');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const noResults = document.getElementById('no-results');

    let currentFilter = 'all';
    let currentSearch = '';

    // FAQ一覧を表示
    const displayFAQs = (faqs) => {
        if (faqs.length === 0) {
            faqList.style.display = 'none';
            noResults.style.display = 'block';
            return;
        }

        faqList.style.display = 'grid';
        noResults.style.display = 'none';

        faqList.innerHTML = faqs.map(faq => `
            <div class="faq-item" data-id="${faq.id}">
                <div class="faq-question">
                    <span class="faq-question-icon">Q.</span>
                    ${escapeHtml(faq.question)}
                </div>
                <div class="faq-answer">
                    <span class="faq-answer-icon">A.</span>
                    ${escapeHtml(faq.answer)}
                </div>
                <div class="faq-meta">
                    <span class="faq-category">${escapeHtml(faq.category)}</span>
                    <div class="faq-services">
                        ${faq.services.map(service => `
                            <span class="service-tag">${escapeHtml(service)}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        // FAQアイテムのクリックイベント
        document.querySelectorAll('.faq-item').forEach(item => {
            item.addEventListener('click', () => {
                const faqId = item.dataset.id;
                const faq = FAQ_DATA.find(f => f.id == faqId);
                if (faq) {
                    showFAQDetail(faq);
                }
            });
        });
    };

    // FAQ詳細表示（モーダル）
    const showFAQDetail = (faq) => {
        const modal = document.createElement('div');
        modal.className = 'faq-modal';
        modal.innerHTML = `
            <div class="faq-modal-content">
                <div class="faq-modal-header">
                    <h2>${escapeHtml(faq.question)}</h2>
                    <button class="faq-modal-close">&times;</button>
                </div>
                <div class="faq-modal-body">
                    <div class="faq-modal-answer">
                        <span class="faq-answer-icon">A.</span>
                        ${escapeHtml(faq.answer)}
                    </div>
                    <div class="faq-modal-meta">
                        <p><strong>カテゴリー:</strong> ${escapeHtml(faq.category)}</p>
                        <p><strong>対象サービス:</strong> ${faq.services.map(s => escapeHtml(s)).join(', ')}</p>
                    </div>
                </div>
            </div>
        `;

        // モーダルスタイル
        const style = document.createElement('style');
        style.textContent = `
            .faq-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
            }
            .faq-modal-content {
                background: white;
                border-radius: 12px;
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            }
            .faq-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e0e0e0;
            }
            .faq-modal-header h2 {
                margin: 0;
                font-size: 1.3em;
                color: #333;
            }
            .faq-modal-close {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .faq-modal-body {
                padding: 24px;
            }
            .faq-modal-answer {
                margin-bottom: 20px;
                line-height: 1.6;
                color: #555;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            .faq-modal-meta {
                background-color: #f8f9fa;
                padding: 16px;
                border-radius: 8px;
                font-size: 0.9em;
            }
            .faq-modal-meta p {
                margin: 8px 0;
            }
            .faq-modal-meta a {
                color: #667eea;
                text-decoration: none;
            }
            .faq-modal-meta a:hover {
                text-decoration: underline;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        // モーダルを閉じる
        const closeModal = () => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
        };

        modal.querySelector('.faq-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    };

    // FAQをフィルタリング
    const filterFAQs = () => {
        let filteredFAQs = [...FAQ_DATA];

        // カテゴリーフィルター
        if (currentFilter !== 'all') {
            const categoryName = FAQ_CATEGORIES.find(c => c.id === currentFilter)?.name;
            if (categoryName) {
                filteredFAQs = filteredFAQs.filter(faq => faq.category === categoryName);
            }
        }

        // 検索フィルター
        if (currentSearch.trim()) {
            const searchTerm = currentSearch.toLowerCase();
            filteredFAQs = filteredFAQs.filter(faq => 
                faq.question.toLowerCase().includes(searchTerm) ||
                faq.answer.toLowerCase().includes(searchTerm) ||
                faq.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))
            );
        }

        displayFAQs(filteredFAQs);
    };

    // 初期表示
    displayFAQs(FAQ_DATA);

    // 検索機能
    searchButton.addEventListener('click', () => {
        currentSearch = searchInput.value;
        filterFAQs();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentSearch = searchInput.value;
            filterFAQs();
        }
    });

    // カテゴリーフィルター
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            // アクティブ状態を更新
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentFilter = button.dataset.category;
            filterFAQs();
        });
    });
}); 