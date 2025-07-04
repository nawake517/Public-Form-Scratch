document.addEventListener('DOMContentLoaded', () => {
    // 開発環境の判定を改善
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isDevelopment ? 'http://localhost:3000' : '';

    // DOM要素の取得
    const formGlobalMessage = document.getElementById('form-global-message');
    const formStepInput = document.getElementById('form-step-input');
    const formStepConfirm = document.getElementById('form-step-confirm');
    const formStepComplete = document.getElementById('form-step-complete');

    const confirmButton = document.getElementById('confirmButton');
    const backButton = document.getElementById('backButton');
    const submitButton = document.getElementById('submitButton');
    const returnToFormButton = document.getElementById('returnToFormButton');

    // 入力フォームのフィールド
    const nameInput = document.querySelector('input[name="name"]');
    const emailInput = document.querySelector('input[name="email"]');
    const serviceSelect = document.querySelector('select[name="service"]');
    const categoryGroup = document.querySelector('[data-group="category"]');
    const plansGroup = document.querySelector('[data-group="plans"]');
    const messageTextarea = document.querySelector('textarea[name="message"]');

    // 現在のフォームデータとステップの状態
    let currentStep = 'form'; // 'form' | 'confirm' | 'complete'
    let formData = {
        name: '',
        email: '',
        service: '',
        category: '',
        plans: [], // Array for checkboxes
        message: ''
    };
    let csrfToken = null;

    // フォームの初期化状態
    let isFormInitialized = false;

    // サービスごとの選択肢の定義（旧 components/ContactForm.tsx から移行）
    const SERVICE_OPTIONS = {
        'サービスA': {
            categories: ['カテゴリー1', 'カテゴリー2', 'カテゴリー3'],
            plans: ['プランa', 'プランb', 'プランc']
        },
        'サービスB': {
            categories: ['カテゴリー4', 'カテゴリー5', 'カテゴリー6'],
            plans: ['プランd', 'プランe', 'プランf']
        },
        'サービスC': {
            categories: ['カテゴリー7', 'カテゴリー8', 'カテゴリー9'],
            plans: ['プランg', 'プランh', 'プランi']
        }
    };

    // 送信中の状態管理
    let isSubmitting = false;

    // 送信ボタンの状態を更新する関数
    const updateSubmitButtonState = (submitting) => {
        console.log('Updating submit button state:', submitting);
        isSubmitting = submitting;
        submitButton.disabled = submitting;
        backButton.disabled = submitting;
        
        const buttonContent = submitButton.querySelector('.button-content');
        const loadingSpinner = buttonContent.querySelector('.loading-spinner');
        const buttonText = buttonContent.querySelector('span');

        if (submitting) {
            console.log('Showing loading spinner');
            loadingSpinner.classList.remove('hidden');
            buttonText.textContent = '送信中...';
        } else {
            console.log('Hiding loading spinner');
            loadingSpinner.classList.add('hidden');
            buttonText.textContent = '送信する';
        }
    };

    // 初期化時にローディングスピナーを非表示に設定
    const loadingSpinner = submitButton.querySelector('.loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }

    // --- ヘルパー関数 ---

    // グローバルメッセージの表示
    const displayGlobalMessage = (message, type, autoHide = false) => {
        formGlobalMessage.textContent = message;
        formGlobalMessage.className = `messages ${type} visible`;
        if (autoHide) {
            setTimeout(() => {
                formGlobalMessage.classList.remove('visible');
            }, 5000);
        }
    };

    // フィールドごとのエラーメッセージ表示
    const displayFieldError = (fieldName, message) => {
        const errorField = document.querySelector(`.error-message-field[data-field="${fieldName}"]`);
        if (errorField) {
            errorField.textContent = message;
            errorField.classList.add('visible', 'error-animation');
            setTimeout(() => {
                errorField.classList.remove('error-animation');
            }, 500);
        }
    };

    // 全てのエラーメッセージをクリア
    const clearAllErrors = () => {
        document.querySelectorAll('.error-message-field').forEach(el => {
            el.textContent = '';
            el.classList.remove('visible');
        });
        formGlobalMessage.textContent = '';
        formGlobalMessage.classList.remove('visible', 'success', 'error');
    };

    // CSRFトークンをサーバーから取得
    const fetchCsrfToken = async () => {
        try {
            console.log('Fetching CSRF token from:', `${API_BASE_URL}/api/csrf-token`);
            const response = await fetch(`${API_BASE_URL}/api/csrf-token`);
            console.log('CSRF token response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('CSRF token response data:', data);
            
            if (!data.csrfToken) {
                throw new Error('CSRF token not found in response');
            }
            
            csrfToken = data.csrfToken;
            console.log('CSRF Token fetched successfully:', csrfToken);
            
            // トークン取得成功時にフォームを初期化
            isFormInitialized = true;
            confirmButton.disabled = false;
            submitButton.disabled = false;
        } catch (error) {
            console.error('Error fetching CSRF token:', error);
            displayGlobalMessage('バックエンドサーバーとの接続が確立されていません。ページを再読み込みしてください。', 'error', false);
            confirmButton.disabled = true;
            submitButton.disabled = true;
            isFormInitialized = false;
        }
    };

    // --- UI更新とデータ管理 ---

    // フォームデータに基づいてUIを更新
    const updateFormUI = () => {
        nameInput.value = formData.name;
        emailInput.value = formData.email;
        serviceSelect.value = formData.service;
        messageTextarea.value = formData.message;

        // カテゴリーとプランの選択肢を動的に生成
        renderCategoryOptions(formData.service);
        renderPlanOptions(formData.service);

        // ラジオボタンのチェック状態を更新
        document.querySelectorAll('input[name="category"]').forEach(radio => {
            radio.checked = formData.category === radio.value;
        });

        // チェックボックスのチェック状態を更新
        document.querySelectorAll('input[name="plans"][type="checkbox"]').forEach(checkbox => {
            checkbox.checked = formData.plans.includes(checkbox.value);
        });

        // サービスが選択されていない場合のカテゴリー・プランの無効化状態
        const isDisabled = !formData.service;
        categoryGroup.classList.toggle('disabled', isDisabled);
        plansGroup.classList.toggle('disabled', isDisabled);
        document.querySelectorAll('.radio-group input, .checkbox-group input').forEach(input => {
            input.disabled = isDisabled;
        });
    };

    // カテゴリーのラジオボタンを動的に描画
    const renderCategoryOptions = (selectedService) => {
        categoryGroup.innerHTML = ''; // Clear existing options
        const categories = selectedService && SERVICE_OPTIONS[selectedService] ? SERVICE_OPTIONS[selectedService].categories : SERVICE_OPTIONS['サービスA'].categories;
        const isDisabled = !selectedService;

        categories.forEach(category => {
            const label = document.createElement('label');
            label.className = 'radio-label';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'category';
            input.value = category;
            input.disabled = isDisabled;
            input.checked = formData.category === category; // Check initial state
            input.addEventListener('change', (e) => {
                formData.category = e.target.value;
                clearFieldError('category');
            });
            input.addEventListener('focus', () => clearFieldError('category'));
            label.appendChild(input);
            label.append(category);
            categoryGroup.appendChild(label);
        });
    };

    // プランのチェックボックスを動的に描画
    const renderPlanOptions = (selectedService) => {
        plansGroup.innerHTML = ''; // Clear existing options
        const plans = selectedService && SERVICE_OPTIONS[selectedService] ? SERVICE_OPTIONS[selectedService].plans : SERVICE_OPTIONS['サービスA'].plans;
        const isDisabled = !selectedService;

        plans.forEach(plan => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'plans';
            input.value = plan;
            input.disabled = isDisabled;
            input.checked = formData.plans.includes(plan); // Check initial state
            input.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!formData.plans.includes(plan)) formData.plans.push(plan);
                } else {
                    formData.plans = formData.plans.filter(p => p !== plan);
                }
            });
            label.appendChild(input);
            label.append(plan);
            plansGroup.appendChild(label);
        });
    };

    // 確認画面のUIを更新
    const updateConfirmationUI = async () => {
        document.getElementById('confirm-name').textContent = formData.name;
        document.getElementById('confirm-email').textContent = formData.email;
        document.getElementById('confirm-service').textContent = formData.service;
        document.getElementById('confirm-category').textContent = formData.category;
        document.getElementById('confirm-plans').textContent = formData.plans.join('・') || 'なし';
        document.getElementById('confirm-message').textContent = formData.message;

        // FAQ機能を動的にインポート
        try {
            const { findRelatedFAQs, escapeHtml } = await import('./faq/faq-data.js');
            
            // 関連するFAQを検索して表示
            const relatedFAQs = findRelatedFAQs(formData.message, formData.service);
            const faqContainer = document.getElementById('related-faqs');
            
            if (relatedFAQs && relatedFAQs.length > 0) {
                faqContainer.innerHTML = `
                    <div class="faq-section">
                        <h3 class="faq-title">関連するよくある質問</h3>
                        <p class="faq-subtitle">入力内容に応じてよくある質問を自動提案しています。お問い合わせ前の早期解決にお役立てください。</p>
                        <div class="faq-list">
                            ${relatedFAQs.map(faq => `
                                <div class="faq-item">
                                    <div class="faq-question">
                                        <span class="faq-icon">Q.</span>
                                        ${escapeHtml(faq.question)}
                                    </div>
                                    <div class="faq-answer">
                                        <span class="faq-icon">A.</span>
                                        ${escapeHtml(faq.answer)}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="faq-note">
                            <p>※ 上記の質問で解決しない場合は、このまま送信をお願いいたします。</p>
                            <p><a href="./faq/" target="_blank" rel="noopener noreferrer" class="faq-all-link">すべてのよくある質問を見る</a></p>
                        </div>
                    </div>
                `;
            } else {
                faqContainer.innerHTML = `
                    <div class="faq-section">
                        <h3 class="faq-title">関連するよくある質問</h3>
                        <p class="faq-subtitle">入力内容に応じたよくある質問が見つかりませんでした。お手数ですが、このまま送信をお願いいたします。</p>
                        <div class="faq-note">
                            <p>※ FAQページの内容が不十分で、ご不便をおかけしております。改善の参考にさせていただきます。</p>
                            <p><a href="./faq/" target="_blank" rel="noopener noreferrer" class="faq-all-link">すべてのよくある質問を見る</a></p>
                        </div>
                    </div>
                `;
            }
            
            // 確実に表示する
            faqContainer.style.display = 'block';
            
        } catch (error) {
            console.error('FAQ機能の読み込みに失敗しました:', error);
            // FAQ機能が読み込めない場合でも、基本的なメッセージを表示
            const faqContainer = document.getElementById('related-faqs');
            faqContainer.innerHTML = `
                <div class="faq-section">
                    <h3 class="faq-title">💡 よくある質問について</h3>
                    <p class="faq-subtitle">よくある質問ページもご用意しております。お問い合わせ前にご確認いただけます。</p>
                    <div class="faq-note">
                        <p><a href="./faq/" target="_blank" rel="noopener noreferrer" class="faq-all-link">すべてのよくある質問を見る</a></p>
                    </div>
                </div>
            `;
            faqContainer.style.display = 'block';
        }
    };

    // ステップ表示を切り替える
    const showStep = async (stepName) => {
        formStepInput.classList.add('hidden');
        formStepConfirm.classList.add('hidden');
        formStepComplete.classList.add('hidden');
        clearAllErrors(); // ステップ切り替え時にエラーをクリア

        if (stepName === 'form') {
            formStepInput.classList.remove('hidden');
        } else if (stepName === 'confirm') {
            formStepConfirm.classList.remove('hidden');
            await updateConfirmationUI();
        } else if (stepName === 'complete') {
            formStepComplete.classList.remove('hidden');
        }
        currentStep = stepName;
    };

    // --- バリデーション ---

    const clearFieldError = (fieldName) => {
        const errorField = document.querySelector(`.error-message-field[data-field="${fieldName}"]`);
        if (errorField) {
            errorField.textContent = '';
            errorField.classList.remove('visible');
        }
    };

    const validateInputForm = () => {
        let isValid = true;
        const errors = {};

        // 氏名
        if (!formData.name.trim()) {
            isValid = false;
            errors.name = '氏名は必須項目です';
        } else if (formData.name.length > 255) {
            isValid = false;
            errors.name = '氏名は255文字以下にしてください';
        }

        // メールアドレス
        if (!formData.email.trim()) {
            isValid = false;
            errors.email = 'メールアドレスは必須項目です';
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
            isValid = false;
            errors.email = '有効なメールアドレスを入力してください';
        } else if (formData.email.length > 255) {
            isValid = false;
            errors.email = 'メールアドレスは255文字以下にしてください';
        }

        // サービス
        if (!formData.service) {
            isValid = false;
            errors.service = 'サービスは必須項目です';
        }

        // カテゴリー
        if (!formData.category) {
            isValid = false;
            errors.category = 'カテゴリーは必須項目です';
        }

        // お問い合わせ内容
        if (!formData.message.trim()) {
            isValid = false;
            errors.message = 'お問い合わせ内容は必須項目です';
        } else if (formData.message.length > 2000) { // バックエンドの制限と合わせる
            isValid = false;
            errors.message = 'お問い合わせ内容は2000文字以内で入力してください';
        }

        // エラーメッセージの表示/非表示
        clearAllErrors(); // まず全てクリア
        Object.keys(errors).forEach(key => {
            displayFieldError(key, errors[key]);
        });

        // 最初のエラー項目までスクロール
        if (!isValid) {
            const firstErrorField = Object.keys(errors)[0];
            const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
            if (errorElement) {
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        return isValid;
    };


    // --- イベントリスナー ---

    // フォーム入力フィールドの変更を検出
    nameInput.addEventListener('change', (e) => { formData.name = e.target.value; clearFieldError('name'); });
    emailInput.addEventListener('change', (e) => { formData.email = e.target.value; clearFieldError('email'); });
    serviceSelect.addEventListener('change', (e) => {
        formData.service = e.target.value;
        formData.category = ''; // サービス変更時にカテゴリーをリセット
        formData.plans = []; // サービス変更時にプランをリセット
        updateFormUI(); // UIを更新してカテゴリー・プランの選択肢を再描画
        clearFieldError('service');
        clearFieldError('category'); // カテゴリーのエラーもクリア
        clearFieldError('plans'); // プランのエラーもクリア
    });
    messageTextarea.addEventListener('change', (e) => { formData.message = e.target.value; clearFieldError('message'); });

    // 入力フィールドのフォーカス時にエラーをクリア
    nameInput.addEventListener('focus', () => clearFieldError('name'));
    emailInput.addEventListener('focus', () => clearFieldError('email'));
    serviceSelect.addEventListener('focus', () => clearFieldError('service'));
    messageTextarea.addEventListener('focus', () => clearFieldError('message'));

    const messageLengthWarning = document.getElementById('message-length-warning');
    messageTextarea.addEventListener('input', (e) => {
        if (e.target.value.length >= 101) {
            messageLengthWarning.textContent = '100文字以内でお願いいたします';
            messageLengthWarning.style.display = 'block';
            messageLengthWarning.classList.add('visible');
        } else {
            messageLengthWarning.textContent = '';
            messageLengthWarning.style.display = 'none';
            messageLengthWarning.classList.remove('visible');
        }
    });

    // 確認画面へ進むボタン
    confirmButton.addEventListener('click', async () => {
        if (!isFormInitialized) {
            displayGlobalMessage('フォームの初期化に失敗しています。ページを再読み込みしてください。', 'error', false);
            return;
        }
        // 現在のフォームデータを収集
        formData = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            service: serviceSelect.value,
            category: document.querySelector('input[name="category"]:checked')?.value || '', // 選択されたラジオボタンの値
            plans: Array.from(document.querySelectorAll('input[name="plans"]:checked')).map(cb => cb.value), // 選択されたチェックボックスの値
            message: messageTextarea.value.trim()
        };

        if (validateInputForm()) {
            await showStep('confirm');
        }
    });

    // 入力画面に戻るボタン (確認画面から)
    backButton.addEventListener('click', () => {
        showStep('form');
        updateFormUI(); // 入力画面に戻った際に現在のフォームデータをUIに反映
    });

    // 送信ボタンのイベントリスナー
    submitButton.addEventListener('click', async () => {
        if (!isFormInitialized) {
            displayGlobalMessage('フォームの初期化に失敗しています。ページを再読み込みしてください。', 'error', false);
            return;
        }
        console.log('Submit button clicked');
        console.log('Current form data:', formData);
        console.log('Current CSRF token:', csrfToken);
        
        // スクリプトタグを含むデータのデバッグログ
        if (formData.message && formData.message.includes('<script>')) {
            console.log('Script tag detected in message:', formData.message);
        }
        
        if (!csrfToken) {
            console.error('No CSRF token available');
            displayGlobalMessage('バックエンドサーバーとの接続が確立されていません。ページを再読み込みしてください。', 'error', false);
            return;
        }

        await submitForm();
    });

    // フォーム送信処理
    const submitForm = async () => {
        console.log('Starting form submission');
        console.log('Form data to be sent:', JSON.stringify(formData, null, 2));
        
        if (isSubmitting) {
            console.log('Already submitting, skipping');
            return;
        }
        
        try {
            console.log('Updating submit button state to submitting');
            updateSubmitButtonState(true);

            console.log('Sending request to:', `${API_BASE_URL}/api/contact`);
            const response = await fetch(`${API_BASE_URL}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(formData)
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (!response.ok) {
                throw new Error(data.message || '送信に失敗しました');
            }

            // 成功時の処理
            displayGlobalMessage('送信が完了しました！', 'success', false);
            showStep('complete');
            
            // フォームデータのリセット
            formData = {
                name: '',
                email: '',
                service: '',
                category: '',
                plans: [],
                message: ''
            };
            updateFormUI();

        } catch (error) {
            console.error('Form submission error:', error);
            displayGlobalMessage(error.message || '送信に失敗しました。もう一度お試しください。', 'error', false);
            showStep('form');
        } finally {
            console.log('Resetting submit button state');
            updateSubmitButtonState(false);
        }
    };

    // フォームのリセット
    const resetForm = () => {
        formData = {
            name: '',
            email: '',
            service: '',
            category: '',
            plans: [],
            message: ''
        };
        updateFormUI();
        clearAllErrors();
        showStep('form');
    };

    // 完了画面からフォームに戻るボタンのイベントリスナー
    returnToFormButton.addEventListener('click', resetForm);

    // 初期化時にCSRFトークンを取得
    fetchCsrfToken();
    updateFormUI(); // 初期データに基づいてUIを更新
    showStep('form'); // 最初のステップを表示

});