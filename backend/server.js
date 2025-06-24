const http = require('http');
const { Pool } = require('pg');
const { URLSearchParams } = require('url');
const nodemailer = require('nodemailer'); // メール送信ライブラリ

// 開発環境でのみdotenvを読み込む
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// データベース接続プールの設定
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // 本番環境ではSSLを有効に
});

// CSRFトークン管理用 (簡易的な例、本番ではより堅牢なセッション管理と連携が必要)
let csrfToken = null;
const generateCsrfToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
// サーバー起動時にトークンを生成
csrfToken = generateCsrfToken();


// Nodemailerトランスポーターの設定 (Gmailのユーザー名とアプリパスワードを環境変数から取得)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // 環境変数から取得
        pass: process.env.GMAIL_APP_PASSWORD // 環境変数から取得 (Gmailのアプリパスワード)
    }
});


// ヘルパー関数: クライアントへのエラーレスポンス送信
const sendError = (res, statusCode, message) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message }));
};

// ヘルパー関数: クライアントへの成功レスポンス送信
const sendSuccess = (res, statusCode, data = {}) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...data }));
};

// サーバーサイドバリデーション
const validateInquiryData = (data) => {
    const errors = [];

    // 必須チェック
    if (!data.name || data.name.trim() === '') errors.push('氏名は必須です。');
    if (!data.email || data.email.trim() === '') errors.push('メールアドレスは必須です。');
    if (!data.service || data.service.trim() === '') errors.push('サービスは必須です。');
    if (!data.category || data.category.trim() === '') errors.push('カテゴリーは必須です。');
    if (!data.message || data.message.trim() === '') errors.push('お問い合わせ内容は必須です。');

    // メールアドレス形式チェック (簡易)
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('メールアドレスの形式が不正です。');
    }

    // 各フィールドの最大長チェック (フロントエンドと合わせる)
    if (data.name && data.name.length > 255) errors.push('氏名は255文字以下にしてください。');
    if (data.email && data.email.length > 255) errors.push('メールアドレスは255文字以下にしてください。');
    if (data.service && data.service.length > 255) errors.push('サービスは255文字以下にしてください。');
    if (data.category && data.category.length > 255) errors.push('カテゴリーは255文字以下にしてください。');
    if (data.message && data.message.length > 2000) errors.push('お問い合わせ内容は2000文字以下にしてください。'); // TEXT型には通常上限はないが、不正なデータ防止のため

    // --- XSS対策の二重防御について ---
    // 下記のようにサーバー側でも<>が含まれていたらエラーにして保存しないことで、
    // フロントエンドでのエスケープと合わせて多層防御を実現できると思いますが、
    // 今回は問い合わせ内容として<>を含むものも有り得るため、コメントアウトします。
    // 
    // for (const key of ['name', 'email', 'service', 'category', 'message']) {
    //     if (data[key] && /[<>]/.test(data[key])) { // <や>が含まれていたらエラー
    //          errors.push(`${key}に不正な文字が含まれています。`);
    //     }
    // }
    // plans配列内の各要素もチェック
    // if (Array.isArray(data.plans)) {
    //     for (const plan of data.plans) {
    //         if (/[<>]/.test(plan)) {
    //             errors.push('プランに不正な文字が含まれています。');
    //             break;
    //         }
    //     }
    // }

    return errors.length > 0 ? errors : null;
};


// HTTPサーバーの作成
const server = http.createServer(async (req, res) => {
    // CORSヘッダーの設定を改善
    const allowedOrigins = [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'https://cypass.net'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // プリフライトリクエストの処理 (OPTIONSメソッド)
    if (req.method === 'OPTIONS') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    // ルーティング
    if (req.url === '/api/contact' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString(); // リクエストボディを収集
        });

        req.on('end', async () => {
            let formData;
            try {
                // Content-Typeがapplication/jsonであることを想定
                const contentType = req.headers['content-type'] || '';
                if (!contentType.includes('application/json')) {
                    return sendError(res, 415, 'Unsupported Media Type: Only application/json is accepted.');
                }
                formData = JSON.parse(body);
                
                // デバッグログ: 受信したデータを確認
                console.log('Received form data:', JSON.stringify(formData, null, 2));
                if (formData.message && formData.message.includes('<script>')) {
                    console.log('Script tag detected in received message:', formData.message);
                }
                
            } catch (error) {
                console.error('Body parsing error:', error);
                return sendError(res, 400, 'リクエストデータの解析に失敗しました。');
            }

            // CSRFトークンの検証
            const clientCsrfToken = req.headers['x-csrf-token'];
            if (!clientCsrfToken || clientCsrfToken !== csrfToken) {
                console.warn('CSRF token mismatch or missing:', { client: clientCsrfToken, server: csrfToken });
                return sendError(res, 403, '不正なリクエストです。'); // 本番環境では403 Forbidden
            }


            // サーバーサイドバリデーションを実行
            const validationErrors = validateInquiryData(formData);
            if (validationErrors) {
                console.warn('Validation errors:', validationErrors);
                return sendError(res, 400, validationErrors.join(' '));
            }
            
            // デバッグログ: バリデーション通過後のデータ
            console.log('Validation passed, proceeding with data save');
            if (formData.message && formData.message.includes('<script>')) {
                console.log('Script tag will be saved to database:', formData.message);
            }

            const { name, email, service, category, plans, message } = formData;

            // データベースへの保存
            try {
                const query = `
                    INSERT INTO inquiries (name, email, service, category, plans, message)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id;
                `;
                // plans は配列として保存するため、JSONB型に対応させる
                const values = [name, email, service, category, JSON.stringify(plans), message];

                const client = await pool.connect();
                try {
                    const result = await client.query(query, values);
                    console.log('Inquiry saved to DB:', result.rows[0]);
                    
                    // デバッグログ: 保存されたデータの確認
                    if (message && message.includes('<script>')) {
                        console.log('Script tag successfully saved to database with ID:', result.rows[0].id);
                    }

                    // メール送信
                    await transporter.sendMail({
                        from: process.env.GMAIL_USER,
                        to: process.env.GMAIL_USER, // 自分のメールアドレス宛に送る
                        subject: '【お問い合わせ】新規のお問い合わせ',
                        text: `
お問い合わせがありました。

■ 氏名
${name}

■ メールアドレス
${email}

■ サービス
${service}

■ カテゴリー
${category}

■ プラン
${plans.join('・')}

■ お問い合わせ内容
${message}
                        `.trim()
                    });
                    console.log('Email sent successfully.');

                    sendSuccess(res, 200, { message: 'お問い合わせを受け付けました。' });

                } finally {
                    client.release(); // コネクションプールに戻す
                }
            } catch (err) {
                console.error('Processing error (DB or Email):', err);
                sendError(res, 500, 'お問い合わせの送信中にエラーが発生しました。');
            }
        });
    } else if (req.url === '/api/csrf-token' && req.method === 'GET') {
        // CSRFトークンを返すエンドポイント
        console.log('CSRF token requested. Current token:', csrfToken);
        if (!csrfToken) {
            csrfToken = generateCsrfToken();
            console.log('Generated new CSRF token:', csrfToken);
        }
        sendSuccess(res, 200, { csrfToken: csrfToken });
    } else if (req.url === '/api/admin/inquiries' && req.method === 'GET') {
        // 管理者用の問い合わせ一覧取得エンドポイント
        try {
            const client = await pool.connect();
            try {
                const result = await client.query(`
                    SELECT id, name, email, service, category, plans, message, created_at
                    FROM inquiries
                    ORDER BY created_at DESC
                `);
                sendSuccess(res, 200, { inquiries: result.rows });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error fetching inquiries:', error);
            sendError(res, 500, '問い合わせデータの取得に失敗しました');
        }
    } else {
        // 未定義のルート
        console.log('404 Not Found:', req.url);
        sendError(res, 404, 'Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// プロセスが終了する際にデータベース接続プールを終了
process.on('SIGINT', async () => {
    await pool.end();
    console.log('Database pool closed.');
    process.exit(0);
});