window.extractArticleContent = function() {
  // 克隆文档以避免修改原始 DOM
  const documentClone = document.cloneNode(true);
  
  // 使用 Readability 解析文章
  const reader = new Readability(documentClone);
  const article = reader.parse();
  
  if (!article) {
    throw new Error('无法解析文章内容');
  }

  return {
    title: article.title,
    excerpt: article.excerpt || article.textContent.slice(0, 500),
    content: article.textContent
  };
}; 