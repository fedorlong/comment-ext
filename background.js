// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 打开侧边栏
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 当扩展安装或更新时
chrome.runtime.onInstalled.addListener(() => {
  // 设置侧边栏默认打开
  chrome.sidePanel.setOptions({
    enabled: true
  });
}); 