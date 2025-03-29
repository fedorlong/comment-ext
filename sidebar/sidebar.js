document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const resultDiv = document.getElementById('result');
  const commentText = document.getElementById('commentText');
  const errorDiv = document.getElementById('error');
  const settingsErrorDiv = document.getElementById('settingsError');
  const loadingDiv = document.getElementById('loading');

  // 定时器引用
  let toastTimerId = null;
  let settingsSavedTimerId = null;
  let copyApiKeyTimerId = null;
  let copyCommentTimerId = null;

  // Toast 元素
  const toast = document.getElementById('toast');
  const toastContent = document.getElementById('toastContent');
  const toastIcon = document.getElementById('toastIcon');
  const toastClose = document.getElementById('toastClose');
  
  // 标签页元素
  const mainTab = document.getElementById('mainTab');
  const settingsTab = document.getElementById('settingsTab');
  const mainContent = document.getElementById('mainContent');
  const settingsContent = document.getElementById('settingsContent');
  
  // 设置页元素
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiVisibility = document.getElementById('toggleApiVisibility');
  const copyApiKey = document.getElementById('copyApiKey');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsSaved = document.getElementById('settingsSaved');
  
  // API Key 变量
  let API_KEY = '';

  // 产品管理相关元素
  const productSelect = document.getElementById('productSelect');
  const addProductBtn = document.getElementById('addProductBtn');
  const deleteProductBtn = document.getElementById('deleteProductBtn');
  const productForm = document.getElementById('productForm');
  const domainInput = document.getElementById('domainInput');
  const keywordInput = document.getElementById('keywordInput');
  const descInput = document.getElementById('descInput');
  const saveProductBtn = document.getElementById('saveProductBtn');
  const cancelProductBtn = document.getElementById('cancelProductBtn');
  const editProductBtn = document.getElementById('editProductBtn');

  let products = [];
  let selectedProductIndex = 0;

  const mock = [{
    domain: 'https://sprunkiplayground.com/',
    keyword: 'sprunki',
    description: 'Sprunki Game is a fan-made expansion of the popular Incredibox music-mixing game'
  }];

  // 从存储加载产品配置
  async function loadProducts() {
    const result = await chrome.storage.sync.get('products');
    products = result?.products || [];
    updateProductSelect();
  }

  // 保存产品配置到存储
  function saveProducts() {
    chrome.storage.sync.set({ products });
  }

  // 更新产品选择下拉框
  function updateProductSelect() {
    productSelect.innerHTML = products.map((product, index) => `
      <option value="${index}">${product.keyword}</option>
    `).join('');
    productSelect.value = selectedProductIndex;
  }

  // 显示产品表单
  function showProductForm(product = { domain: '', keyword: '', description: '' }, isEditing = false) {
    domainInput.value = product.domain;
    keywordInput.value = product.keyword;
    descInput.value = product.description;
    productForm.dataset.editing = isEditing;
    productForm.classList.remove('hidden');
  }

  // 隐藏产品表单
  function hideProductForm() {
    productForm.classList.add('hidden');
    domainInput.value = '';
    keywordInput.value = '';
    descInput.value = '';
  }

  // 事件监听器
  productSelect.addEventListener('change', (e) => {
    selectedProductIndex = parseInt(e.target.value);
    
    // 如果产品表单正在显示，则隐藏它
    if (!productForm.classList.contains('hidden')) {
      hideProductForm();
    }
  });

  addProductBtn.addEventListener('click', () => {
    showProductForm({ domain: '', keyword: '', description: '' }, false);
  });

  editProductBtn.addEventListener('click', () => {
    showProductForm(products[selectedProductIndex], true);
  });

  deleteProductBtn.addEventListener('click', () => {
    if (products.length <= 1) {
      showToast('At least one product configuration is required');
      return;
    }
    if (confirm('Are you sure you want to delete this product?')) {
      products.splice(selectedProductIndex, 1);
      selectedProductIndex = 0;
      saveProducts();
      updateProductSelect();
      showToast('Product deleted successfully', 'success');
    }
  });

  // 添加新产品
  function addProduct(domain, keyword, description) {
    products.push({ domain, keyword, description });
    selectedProductIndex = products.length - 1;
    saveProducts();
    updateProductSelect();
  }

  // 更新现有产品
  function updateProduct(index, domain, keyword, description) {
    if (index >= 0 && index < products.length) {
      products[index] = { domain, keyword, description };
      saveProducts();
      updateProductSelect();
    }
  }

  saveProductBtn.addEventListener('click', () => {
    const domain = domainInput.value.trim();
    const keyword = keywordInput.value.trim();
    const description = descInput.value.trim();

    if (!domain || !keyword || !description) {
      showToast('Please fill in all fields');
      return;
    }

    try {
      if (productForm.dataset.editing === 'true') {
        updateProduct(selectedProductIndex, domain, keyword, description);
        showToast('Product updated successfully', 'success');
      } else {
        addProduct(domain, keyword, description);
        showToast('Product added successfully', 'success');
      }

      hideProductForm();
    } catch (error) {
      showToast('Failed to save product configuration');
      return;
    }
    
    delete productForm.dataset.editing;
  });

  cancelProductBtn.addEventListener('click', hideProductForm);

  // 获取选中的 rel 属性
  function getSelectedRels() {
    const checkboxes = document.querySelectorAll('input[name="rel"]:checked');
    return Array.from(checkboxes).map(cb => cb.value).join(' ');
  }

  generateBtn.addEventListener('click', async () => {
    try {
      if (!API_KEY) {
        showToast('Please set your API Key in the Settings tab');
        settingsTab.click(); // 自动切换到设置标签页
        return;
      }
      
      // 提前检查产品配置
      if (products.length === 0) {
        showToast('Please add at least one product configuration');
        return;
      }
      
      const currentProduct = products[selectedProductIndex];
      if (!currentProduct) {
        showToast('Invalid product selection');
        return;
      }
      
      // 清除之前的错误信息
      errorDiv.classList.add('hidden');
      showLoading(true);
      
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 提取文章内容
      const article = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractArticleContent
      });
      
      // 获取提取的内容
      const { title, excerpt } = article[0].result;
      
      if (!title || !excerpt) {
        throw new Error('Could not extract content from the page. Please make sure you are on a page with readable content.');
      }
      
      const selectedRels = getSelectedRels();
      
      // 调用 OpenRouter API 使用 DeepSeek 模型
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://github.com', // 你的网站 URL
          'X-Title': 'Blog Comment Assistant' // 你的应用名称
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1:free",
          messages: [{
            role: "system",
            content: "You are a friendly blog commenter. Write brief, natural comments in simple English (6th-grade level). Don't use quotation marks around the comment. Don't include word counts. Use the keyword description to understand the context but keep mentions brief and natural."
          }, {
            role: "user",
            content: `Write a short, natural comment (30-50 words):
Title: ${title}
Content: ${excerpt}
Keyword: ${currentProduct.keyword}
Keyword Description: ${currentProduct.description}

Guidelines:
1. Write directly without quotation marks
2. Don't include word counts or meta information
3. Keep the tone casual and friendly
4. The keyword MUST be wrapped in {{}} exactly like this: {{${currentProduct.keyword}}}
5. Make everything flow smoothly

Example format:
Great article about [topic]. I've found {{${currentProduct.keyword}}} really useful for this kind of thing.

or

Interesting points here. This reminds me of {{${currentProduct.keyword}}} - it's quite helpful in similar situations.`
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API call failed: ${errorData.message || response.statusText}`);
      }
      
      const data = await response.json();
      let comment = data.choices[0].message.content;
      
      // 替换 {{keyword}} 为实际的链接
      const linkHtml = `<a href="${currentProduct.domain}" rel="${selectedRels}">${currentProduct.keyword}</a>`;
      comment = comment.replace(/\{\{([^}]+)\}\}/g, linkHtml);

      showResult(comment);
    } catch (error) {
      showToast(error.message);
      // 同时显示持久的错误信息
      showPersistentError(error.message);
    } finally {
      showLoading(false);
    }
  });

  copyBtn.addEventListener('click', () => {
    commentText.select();
    document.execCommand('copy');
    
    // 保存原始按钮内容
    const originalHTML = copyBtn.innerHTML;
    
    // 更改按钮样式和内容以显示成功状态
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
      </svg>
      Copied
    `;
    copyBtn.style.backgroundColor = '#f0fdf4';
    copyBtn.style.color = '#16a34a';
    copyBtn.style.borderColor = '#bbf7d0';
    
    // 清除之前的定时器
    if (copyCommentTimerId) {
      clearTimeout(copyCommentTimerId);
    }
    
    // 设置新的定时器，恢复按钮原始状态
    copyCommentTimerId = setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.style.backgroundColor = '';
      copyBtn.style.color = '';
      copyBtn.style.borderColor = '';
      copyCommentTimerId = null;
    }, 1500);
  });

  function showResult(comment) {
    commentText.value = comment;
    resultDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }

  function showLoading(show) {
    loadingDiv.classList.toggle('hidden', !show);
    generateBtn.disabled = show;
  }

  // 标签页切换
  mainTab.addEventListener('click', () => {
    mainTab.classList.add('active');
    settingsTab.classList.remove('active');
    mainContent.classList.add('active');
    settingsContent.classList.remove('active');
    settingsErrorDiv.classList.add('hidden');
  });
  
  settingsTab.addEventListener('click', () => {
    settingsTab.classList.add('active');
    mainTab.classList.remove('active');
    settingsContent.classList.add('active');
    mainContent.classList.remove('active');
    errorDiv.classList.add('hidden');
  });
  
  // API Key 可见性切换
  toggleApiVisibility.addEventListener('click', () => {
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeSlashIcon = document.getElementById('eyeSlashIcon');
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      eyeIcon.classList.add('hidden');
      eyeSlashIcon.classList.remove('hidden');
    } else {
      apiKeyInput.type = 'password';
      eyeSlashIcon.classList.add('hidden');
      eyeIcon.classList.remove('hidden');
    }
  });
  
  // 保存设置
  saveSettingsBtn.addEventListener('click', () => {
    // 清理 API Key (移除所有空格和不可见字符)
    let newApiKey = apiKeyInput.value.trim().replace(/\s+/g, '');
    
    if (!newApiKey) {
      showToast('Please enter a valid API Key');
      return;
    }
    
    API_KEY = newApiKey;
    chrome.storage.sync.set({ apiKey: API_KEY });
    
    // 显示成功消息
    settingsSaved.classList.remove('hidden');
    settingsErrorDiv.classList.add('hidden');
    
    // 清除之前的定时器
    if (settingsSavedTimerId) {
      clearTimeout(settingsSavedTimerId);
    }
    
    // 设置新的定时器
    settingsSavedTimerId = setTimeout(() => {
      settingsSaved.classList.add('hidden');
      settingsSavedTimerId = null;
    }, 3000);
  });
  
  // 加载 API Key
  async function loadApiKey() {
    const result = await chrome.storage.sync.get('apiKey');
    if (result.apiKey) {
      API_KEY = result.apiKey;
      apiKeyInput.value = result.apiKey;
    }
  }
  
  // 复制 API Key
  copyApiKey.addEventListener('click', () => {
    if (API_KEY) {
      navigator.clipboard.writeText(API_KEY).then(() => {
        // 临时改变按钮文本表示成功
        const originalHTML = copyApiKey.innerHTML;
        copyApiKey.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
          <span class="tooltip">Copied!</span>
        `;
        copyApiKey.style.backgroundColor = '#dcfce7';
        copyApiKey.style.color = '#16a34a';
        copyApiKey.style.borderColor = '#bbf7d0';
        
        // 清除之前的定时器
        if (copyApiKeyTimerId) {
          clearTimeout(copyApiKeyTimerId);
        }
        
        // 设置新的定时器
        copyApiKeyTimerId = setTimeout(() => {
          copyApiKey.innerHTML = originalHTML;
          copyApiKey.style.backgroundColor = '';
          copyApiKey.style.color = '';
          copyApiKey.style.borderColor = '';
          copyApiKeyTimerId = null;
        }, 1500);
      });
    }
  });

  // 关闭 toast
  toastClose.addEventListener('click', () => {
    toast.classList.remove('show');
    
    // 清除自动关闭的定时器
    if (toastTimerId) {
      clearTimeout(toastTimerId);
      toastTimerId = null;
    }
  });
  
  // 显示 toast 消息
  function showToast(message, type = 'error') {
    toastContent.textContent = message;
    
    // 设置图标
    if (type === 'error') {
      toast.className = 'toast error show';
      toastIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#ef4444" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>`;
    } else if (type === 'success') {
      toast.className = 'toast success show';
      toastIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#10b981" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
        </svg>`;
    }
    
    // 清除之前的定时器
    if (toastTimerId) {
      clearTimeout(toastTimerId);
    }
    
    // 3秒后自动关闭
    toastTimerId = setTimeout(() => {
      toast.classList.remove('show');
      toastTimerId = null;
    }, 3000);
  }

  // 显示持久的错误信息
  function showPersistentError(message) {
    errorDiv.innerHTML = `
      <div>${message}</div>
      <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
        You can try again later or check if the page content is accessible.
      </div>
    `;
    errorDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
  }

  // 在页面卸载时清除所有定时器
  window.addEventListener('unload', () => {
    if (toastTimerId) clearTimeout(toastTimerId);
    if (settingsSavedTimerId) clearTimeout(settingsSavedTimerId);
    if (copyApiKeyTimerId) clearTimeout(copyApiKeyTimerId);
    if (copyCommentTimerId) clearTimeout(copyCommentTimerId);
  });

  // 初始化
  loadApiKey();
  loadProducts();
}); 