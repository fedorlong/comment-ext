document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const resultDiv = document.getElementById('result');
  const commentText = document.getElementById('commentText');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');

  // 硬编码 API key
  const API_KEY = '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';  // 替换为你的 API key

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

  // 从存储加载产品配置
  async function loadProducts() {
    const result = await chrome.storage.sync.get('products');
    products = result.products || [{
      domain: 'https://sprunkiplayground.com/',
      keyword: 'sprunki',
      description: 'Sprunki Game is a fan-made expansion of the popular Incredibox music-mixing game'
    }];
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
  });

  addProductBtn.addEventListener('click', () => {
    showProductForm({}, false);
  });

  editProductBtn.addEventListener('click', () => {
    showProductForm(products[selectedProductIndex], true);
  });

  deleteProductBtn.addEventListener('click', () => {
    if (products.length <= 1) {
      showError('At least one product configuration is required');
      return;
    }
    if (confirm('Are you sure you want to delete this product?')) {
      products.splice(selectedProductIndex, 1);
      selectedProductIndex = 0;
      saveProducts();
      updateProductSelect();
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
      showError('Please fill in all fields');
      return;
    }

    try {
      if (productForm.dataset.editing === 'true') {
        updateProduct(selectedProductIndex, domain, keyword, description);
      } else {
        addProduct(domain, keyword, description);
      }

      hideProductForm();
    } catch (error) {
      showError('Failed to save product configuration');
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
      showLoading(true);
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('无法获取当前页面');

      // 在页面中提取内容
      const [{result}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['lib/readability.js', 'lib/extractor.js']
      });

      // 提取文章内容
      const content = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.extractArticleContent()
      });

      const article = content[0].result;
      if (!article) throw new Error('无法提取文章内容');

      const currentProduct = products[selectedProductIndex];
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
Title: ${article.title}
Content: ${article.excerpt}
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
      showError(error.message);
    } finally {
      showLoading(false);
    }
  });

  copyBtn.addEventListener('click', () => {
    commentText.select();
    document.execCommand('copy');
  });

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
  }

  function showResult(comment) {
    commentText.value = comment;
    resultDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }

  function showLoading(show) {
    loadingDiv.classList.toggle('hidden', !show);
    generateBtn.disabled = show;
  }

  // 初始化
  loadProducts();
}); 