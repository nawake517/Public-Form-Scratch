document.addEventListener('DOMContentLoaded', async () => {
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : '';

    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error-message');
    const noDataElement = document.getElementById('no-data');
    const inquiryListBody = document.getElementById('inquiry-list-body');

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/inquiries`);
        if (!response.ok) {
            throw new Error('問い合わせデータの取得に失敗しました');
        }

        const data = await response.json();
        
        if (!data.inquiries || data.inquiries.length === 0) {
            loadingElement.style.display = 'none';
            noDataElement.style.display = 'block';
            return;
        }

        // データを日時で降順にソート
        data.inquiries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // テーブルにデータを表示
        data.inquiries.forEach(inquiry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(inquiry.id)}</td>
                <td>${escapeHtml(inquiry.name)}</td>
                <td>${escapeHtml(inquiry.email)}</td>
                <td>${escapeHtml(inquiry.service)}</td>
                <td>${escapeHtml(inquiry.category)}</td>
                <td>${(() => { try { return inquiry.plans ? JSON.parse(inquiry.plans).join('・') : ''; } catch (e) { return inquiry.plans || ''; } })()}</td>
                <td class="message-cell" title="${escapeHtml(inquiry.message)}">${escapeHtml(inquiry.message)}</td>
                <td class="timestamp">${formatDate(inquiry.created_at)}</td>
            `;
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                showModal(inquiry);
            });
            inquiryListBody.appendChild(row);
        });

        loadingElement.style.display = 'none';
    } catch (error) {
        console.error('Error fetching inquiries:', error);
        loadingElement.style.display = 'none';
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
});

// HTMLエスケープ関数
function escapeHtml(str) {
    if (typeof str !== 'string') {
        if (str === null || str === undefined) return '';
        return String(str);
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 日時フォーマット関数
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// モーダル表示用関数
function showModal(inquiry) {
    const modal = document.getElementById('modal');
    const modalDetail = document.getElementById('modal-detail');
    modalDetail.innerHTML = `
        <h2>問い合わせ詳細</h2>
        <table>
            <tr><th>ID</th><td>${escapeHtml(inquiry.id)}</td></tr>
            <tr><th>氏名</th><td>${escapeHtml(inquiry.name)}</td></tr>
            <tr><th>メールアドレス</th><td>${escapeHtml(inquiry.email)}</td></tr>
            <tr><th>サービス</th><td>${escapeHtml(inquiry.service)}</td></tr>
            <tr><th>カテゴリー</th><td>${escapeHtml(inquiry.category)}</td></tr>
            <tr><th>プラン</th><td>${(() => { try { return inquiry.plans ? JSON.parse(inquiry.plans).join('・') : ''; } catch (e) { return inquiry.plans || ''; } })()}</td></tr>
            <tr><th>お問い合わせ内容</th><td style="white-space:pre-wrap;">${escapeHtml(inquiry.message)}</td></tr>
            <tr><th>受付日時</th><td>${formatDate(inquiry.created_at)}</td></tr>
        </table>
    `;
    modal.style.display = 'flex';
}
document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
});
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
        document.getElementById('modal').style.display = 'none';
    }
}); 