const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_MESSAGE = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_message;

Page({
  behaviors: [loginTipBehavior],

  /*———————————————— 页面数据绑定 ————————————————*/
  data: {
    self_url: null,

    one_consumer: {},           // 当前聊天对象信息
    receiver_openid: null,      // 消息接收者的openid

    inputValue: '',             // 输入框当前内容
    messageList: [],            // 消息列表数据
    recallMessageId: null,      // 记录被撤回的消息ID，用于样式判断

    scrollToView: '',           // 滚动到指定元素
    scrollTop: 0,               // 滚动条位置
    keyboardHeight: 0,          // 键盘高度
    inputBarBottom: 0,          // 输入栏底部距离
    keyboardTransitionDuration: 250,  // 键盘动画过渡时间
    isKeyboardShow: false,      // 键盘是否显示中
    scrollViewHeight: 0,        // 滚动视图高度
    windowHeight: 0,            // 窗口高度

    menuVisible: false,         // 长按菜单显示状态
    menuTop: 0,                 // 菜单Y坐标位置
    menuLeft: 0,                // 菜单X坐标位置
    currentMessage: null,       // 当前长按操作的消息对象
    showRecall: false,          // 是否显示撤回按钮（2分钟内）
    menuPosition: 'top',        // 菜单显示位置：top/bottom
    menuArrowLeft: 0,           // 菜单箭头水平偏移位置
    
    // 新增：标记是否正在处理确认事件
    isConfirming: false,
  },

  /*———————————————— 页面私有变量 ————————————————*/
  _onNewMessage: null,          // 新消息监听器函数引用（用于正确移除）
  _lastMsgKey: null,            // 上一条消息的唯一标识（用于防重复处理）
  _isConnected: false,          // WebSocket连接状态标志
  _pendingMessages: [],         // 待处理的消息队列（连接断开时暂存）
  _connectionInterval: null,    // 连接状态检测定时器
  _confirmTimer: null,          // 确认延迟定时器
  _inputElementId: 'chat-input', // 输入框ID
  _TIME_INTERVAL: 5 * 60 * 1000, // 时间间隔阈值：5分钟（可根据需要调整）

  /*———————————————— 生命周期：页面加载 ————————————————*/
  onLoad(options) {
    // 初始化连接监听
    this._onNewMessage = this.onNewMessage.bind(this);
    getApp().onEvent('newMessage', this._onNewMessage);

    this.setData({
      self_url: this.getUserInfo().avatarUrl
    });
   
    // 启动连接状态检测
    this.startConnectionMonitor();

    // 获取窗口高度并计算滚动区域
    const systemInfo = wx.getSystemInfoSync();
    this.setData({ windowHeight: systemInfo.windowHeight });
    this.calculateScrollViewHeight();

    // 接收上个页面传递的聊天对象数据
    const eventChannel = this.getOpenerEventChannel();
    this.showLoading();
    eventChannel.on('sendData', (data) => {
      this.setData({
        one_consumer: data.one_consumer,
        receiver_openid: data.one_consumer.openid
      });
      this.loadHistoryMessages(this.getUserInfo().openId, this.data.receiver_openid);
      this.hideLoading();
    });
  },

  /*———————————————— 生命周期：页面渲染完成 ————————————————*/
  onReady() {
    setTimeout(() => {
      this.scrollToBottom();
    }, 500);
  },
  
  /*———————————————— 生命周期：页面卸载 ————————————————*/
  onUnload() {
    // 清除定时器
    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer);
    }
    // 移除事件监听，防止内存泄漏
    if (this._onNewMessage) {
      getApp().offEvent('newMessage', this._onNewMessage);
      this._onNewMessage = null;
    }
    // 清除定时器
    if (this._connectionInterval) {
      clearInterval(this._connectionInterval);
    }
    const currentChatOpenid = this.data.one_consumer?.openid;

    if (currentChatOpenid) {
      const app = getApp();
      app.clearUnreadCount(currentChatOpenid);
      app.updateTabBarBadge();
    }
  },

  /*———————————————— 连接状态管理 ————————————————*/
  // 启动WebSocket连接状态监控，每3秒检测一次
  startConnectionMonitor() {
    const app = getApp();
    const checkConnection = () => {
      this._isConnected = app.getSocketStatus();
      // 连接恢复时，处理积压的消息队列
      if (this._isConnected && this._pendingMessages.length > 0) {
        const pendingCopy = [...this._pendingMessages];
        this._pendingMessages = [];
        pendingCopy.forEach(msg => {
          if (msg.type === 'send') {
            this.sendMessage(msg.to, msg.content);
          } else {
            this.processMessage(msg);
          }
        });
      }
    };
    checkConnection();
    this._connectionInterval = setInterval(checkConnection, 3000);
  },

  /*———————————————— 历史消息加载 ————————————————*/
  // 从服务器加载历史聊天记录
  loadHistoryMessages(openid, receiver) {
    wx.request({
      url: GET_MESSAGE,
      method: 'POST',
      data: { openid, receiver },
      header: { 'content-type': 'application/x-www-form-urlencoded' },
      success: (res) => {
        console.log('加载的历史消息:', res.data);
        
        // 处理服务器返回的消息列表（包含isRecalled字段）
        const messageList = (res.data || []).map(msg => {
          // 关键修改：如果消息已被撤回，直接转换为系统消息，不显示原始内容
          if (msg.isRecalled === true || msg.isRecalled === 1) {
            console.log('发现撤回消息:', msg.id, '原始内容:', msg.content);
            // 返回系统消息格式
            return {
              id: msg.id,
              content: msg.senderOpenid === openid ? '你撤回了一条消息' : '对方撤回了一条消息',
              isSystem: true,
              isRecallTip: true,
              recallFor: msg.id,
              createTime: this.formatMessageTime(msg.sendTime),
              timestamp: new Date(msg.sendTime).getTime(),
              sendTime: msg.sendTime,
              _shouldPersist: true
            };
          }
          
          // 正常消息
          return {
            ...msg,
            isSelf: msg.senderOpenid === openid,
            createTime: this.formatMessageTime(msg.sendTime),
            timestamp: new Date(msg.sendTime).getTime(),
            isRecalled: false
          };
        });
        
        // 添加时间标签
        const processedList = this.addTimeTipsToMessages(messageList);
        
        this.setData({ messageList: processedList }, () => {
          this.scrollToBottom();
        });
      },
      fail: (err) => {
        console.error('加载历史消息失败:', err);
      }
    });
  },

  /*———————————————— 消息接收处理 ————————————————*/
  // WebSocket消息监听回调
  onNewMessage(msg) {
    console.log('收到新消息:', msg);
    
    // 处理撤回通知类型（实时撤回通知）
    if (msg.type === 'message_recalled') {
      console.log('收到撤回通知:', msg);
      this.handleRecallNotification(msg);
      return;
    }

    // 处理普通消息（可能包含isRecalled字段）
    if (this.data.receiver_openid && msg.from !== this.data.receiver_openid) return;
    this.processMessage(msg);
  },

  // 处理撤回通知
  handleRecallNotification(msg) {
    const openid = this.getUserInfo().openId;
    
    // 直接在消息列表中更新被撤回的消息
    const messageList = this.data.messageList;
    let updatedList = [...messageList];
    let foundIndex = -1;
    
    // 找到被撤回的消息并替换为系统消息
    for (let i = 0; i < updatedList.length; i++) {
      if (String(updatedList[i].id) === String(msg.messageId) && !updatedList[i].isSystem) {
        foundIndex = i;
        break;
      }
    }
    
    if (foundIndex !== -1) {
      // 替换为系统消息
      updatedList[foundIndex] = {
        id: updatedList[foundIndex].id,
        content: msg.isSelf ? '你撤回了一条消息' : '对方撤回了一条消息',
        isSystem: true,
        isRecallTip: true,
        recallFor: msg.messageId,
        createTime: updatedList[foundIndex].createTime,
        timestamp: updatedList[foundIndex].timestamp,
        sendTime: updatedList[foundIndex].sendTime,
        _shouldPersist: true
      };
      
      // 重新处理时间标签
      const processedList = this.addTimeTipsToMessages(updatedList);
      this.setData({ messageList: processedList });
      console.log('已更新撤回消息:', msg.messageId);
    } else {
      // 如果没找到，重新加载历史消息
      console.log('未找到要撤回的消息，重新加载历史消息');
      this.loadHistoryMessages(openid, this.data.receiver_openid);
    }
  },

  // 核心消息处理：添加到列表并刷新
  processMessage(msg) {
    const msgKey = `${msg.from}_${msg.content}_${msg.time}_${msg.id}`;
    if (this._lastMsgKey === msgKey) return;
    this._lastMsgKey = msgKey;

    const openid = this.getUserInfo().openId;
    let tempMessage;
    
    // 检查消息是否已被撤回
    if (msg.isRecalled === true || msg.isRecalled === 1) {
      tempMessage = {
        id: msg.id || Date.now(),
        content: (msg.isSelf || msg.senderOpenid === openid) ? '你撤回了一条消息' : '对方撤回了一条消息',
        isSystem: true,
        isRecallTip: true,
        recallFor: msg.id,
        createTime: this.formatTime(new Date()),
        timestamp: Date.now(),
        sendTime: msg.sendTime || new Date().toISOString(),
        _shouldPersist: true
      };
    } else {
      tempMessage = {
        id: msg.id || Date.now(),
        content: msg.content,
        type: 'text',
        createTime: this.formatTime(new Date()),
        isSelf: msg.isSelf || (msg.senderOpenid === openid),
        status: 'success',
        timestamp: Date.now(),
        sendTime: msg.sendTime || new Date().toISOString(),
        isRecalled: false
      };
    }

    // 先添加临时消息
    let newList = [...this.data.messageList, tempMessage];
    // 处理时间标签
    newList = this.addTimeTipsToMessages(newList);
    
    this.setData({ messageList: newList });

    // 延迟刷新历史记录以确保同步
    setTimeout(() => {
      this.loadHistoryMessages(openid, this.data.receiver_openid);
    }, 100);

    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  },

  /*———————————————— 时间标签处理函数 ————————————————*/
  /**
   * 为消息列表添加时间标签
   * @param {Array} messages 消息列表
   * @returns {Array} 添加了时间标签的消息列表
   */
  addTimeTipsToMessages(messages) {
    if (!messages || messages.length === 0) return messages;
    
    const result = [];
    let lastTimestamp = null;
    
    for (let i = 0; i < messages.length; i++) {
      const currentMsg = messages[i];
      const currentTimestamp = currentMsg.timestamp || currentMsg.sendTime || currentMsg.id;
      
      // 判断是否需要显示时间标签
      let shouldShowTimeTip = false;
      let timeTipText = '';
      
      if (i === 0) {
        // 第一条消息显示时间
        shouldShowTimeTip = true;
        timeTipText = this.formatTimeTip(currentTimestamp);
      } else if (lastTimestamp) {
        // 检查与上一条消息的时间间隔
        const timeDiff = Math.abs(currentTimestamp - lastTimestamp);
        if (timeDiff >= this._TIME_INTERVAL) {
          shouldShowTimeTip = true;
          timeTipText = this.formatTimeTip(currentTimestamp);
        }
      }
      
      // 复制消息对象，避免修改原对象
      const newMsg = { ...currentMsg };
      
      // 如果是第一条消息或者时间间隔超过阈值，添加时间标签
      if (shouldShowTimeTip) {
        newMsg.showTimeTip = true;
        newMsg.timeTipText = timeTipText;
      } else {
        newMsg.showTimeTip = false;
      }
      
      result.push(newMsg);
      lastTimestamp = currentTimestamp;
    }
    
    return result;
  },

  /**
   * 格式化时间标签显示文本
   * @param {number|string} timestamp 时间戳
   * @returns {string} 格式化后的时间文本
   */
  formatTimeTip(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 24 * 3600 * 1000);
    
    // 判断是否是今天
    if (date >= today) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    // 判断是否是昨天
    else if (date >= yesterday && date < today) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `昨天 ${hours}:${minutes}`;
    }
    // 判断是否是今年
    else if (date.getFullYear() === now.getFullYear()) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}月${day}日 ${hours}:${minutes}`;
    }
    // 更早的消息
    else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    }
  },

  /*———————————————— 消息发送处理 ————————————————*/
  // 处理键盘确认按钮
  onConfirmSend(e) {
    // 方法1：直接从事件对象中获取值（推荐）
    let realValue = '';
    
    // 优先从事件对象获取（键盘确认时会携带当前输入框的值）
    if (e.detail && e.detail.value !== undefined) {
      realValue = e.detail.value;
    } 
    // 备用：从 data 中获取
    else {
      realValue = this.data.inputValue;
    }
    
    // 关键：即使事件值获取到了，也需要确保 data 同步
    if (realValue !== this.data.inputValue) {
      this.setData({ inputValue: realValue });
    }
    
    const content = realValue.trim();
    if (content) {
      // 使用 nextTick 确保数据更新完成后再发送
      wx.nextTick(() => {
        this.doSendMessage(content);
      });
    }
  },

  // 发送按钮点击处理
  onSendMessage() {
    // 如果正在处理确认事件，避免重复发送
    if (this.data.isConfirming) {
      return;
    }
    
    const content = this.data.inputValue.trim();
    if (!content) return;
    this.doSendMessage(content);
  },

  // 实际发送逻辑
  doSendMessage(content) {
    const receiver_openid = this.data.receiver_openid;

    // 乐观更新：先显示在界面上
    const newMessage = {
      id: Date.now(),
      content: content,
      type: 'text',
      receiver: receiver_openid,
      createTime: this.formatTime(new Date()),
      isSelf: true,
      status: 'sending',
      timestamp: Date.now(),
      isRecalled: false
    };

    // 添加新消息并重新处理时间标签
    let newList = [...this.data.messageList, newMessage];
    newList = this.addTimeTipsToMessages(newList);
    
    this.setData({
      messageList: newList,
      inputValue: ''
    });

    // 实际发送消息
    this.sendMessage(receiver_openid, content);

    // 延迟刷新历史记录
    setTimeout(() => {
      this.loadHistoryMessages(this.getUserInfo().openId, receiver_openid);
    }, 500);

    // 根据键盘状态决定滚动方式
    if (this.data.isKeyboardShow) {
      setTimeout(() => this.scrollLastMessageToVisible(), 100);
    } else {
      this.scrollToBottom();
    }
  },

  // 通过WebSocket发送消息
  sendMessage(receiver_openid, content) {
    const app = getApp();

    if (!this._isConnected) {
      wx.showToast({ title: '网络连接中，请稍后', icon: 'none', duration: 2000 });
      setTimeout(() => {
        if (this._isConnected) {
          app.sendMessage({ to: receiver_openid, content });
        } else {
          wx.showToast({ title: '网络异常，发送失败', icon: 'none' });
        }
      }, 3000);
      return;
    }

    app.sendMessage({ to: receiver_openid, content });
  },

  /*———————————————— 长按菜单：显示与定位 ————————————————*/
  // 长按消息气泡，显示操作菜单
  onLongPressMessage(e) {
    const message = e.currentTarget.dataset.message;
    if (!message) return;

    // 撤回的消息（系统消息）不能长按操作
    if (message.isSystem) {
      console.log('系统消息不能长按操作');
      return;
    }

    this.setData({ currentMessage: message });

    let showRecall = false;
    // 只有自己发送的、未被撤回的消息才能撤回
    if (message.isSelf && !message.isRecalled && !message.isSystem) {
      const timeDiff = (Date.now() - (message.timestamp || message.id)) / 1000;
      if (timeDiff <= 120) showRecall = true;
    }
    this.setData({ showRecall });

    const bubbleId = `#bubble-${message.id}`;
    const query = wx.createSelectorQuery();
    query.select(bubbleId).boundingClientRect();
    query.exec((res) => {
      const bubbleRect = res[0];
      if (!bubbleRect) {
        this.setData({ menuVisible: true, menuTop: 200, menuLeft: 100 });
        return;
      }
      this.showMenuAtPosition(bubbleRect, message);
    });
  },

  // 计算并显示菜单位置
  showMenuAtPosition(bubbleRect, message) {
    const systemInfo = wx.getSystemInfoSync();
    const windowHeight = systemInfo.windowHeight;
    const windowWidth = systemInfo.windowWidth;

    const menuWidth = this.calculateMenuWidth();
    const menuHeight = 36;

    const bubbleCenter = bubbleRect.top + bubbleRect.height / 2;
    const isBubbleInUpperHalf = bubbleCenter < windowHeight / 2;

    let menuTop, position;
    if (isBubbleInUpperHalf) {
      menuTop = bubbleRect.bottom + 8;
      position = 'bottom';
    } else {
      menuTop = bubbleRect.top - menuHeight - 8;
      position = 'top';
    }

    menuTop = Math.max(10, Math.min(menuTop, windowHeight - menuHeight - 10));

    let menuLeft = bubbleRect.left + (bubbleRect.width / 2) - (menuWidth / 2);
    menuLeft = Math.max(8, Math.min(menuLeft, windowWidth - menuWidth - 8));

    let arrowLeft = (bubbleRect.left + bubbleRect.width / 2) - menuLeft;
    arrowLeft = Math.max(10, Math.min(menuWidth - 10, arrowLeft));

    this.setData({
      menuVisible: true,
      menuTop,
      menuLeft,
      menuPosition: position,
      menuArrowLeft: arrowLeft
    });
  },

  // 计算菜单总宽度
  calculateMenuWidth() {
    const charWidth = 13;
    const paddingWidth = 24;
    const dividerWidth = 1;
    const getItemWidth = (text) => text.length * charWidth + paddingWidth + dividerWidth;

    let totalWidth = getItemWidth('复制');
    if (this.data.showRecall) totalWidth += getItemWidth('撤回');
    totalWidth += getItemWidth('删除');
    return totalWidth;
  },

  /*———————————————— 长按菜单：功能操作 ————————————————*/
  onMenuCopy() {
    const message = this.data.currentMessage;
    if (!message) return;
    wx.setClipboardData({
      data: message.content,
      success: () => wx.showToast({ title: '已复制', icon: 'success', duration: 1000 })
    });
    this.hideMenu();
  },

  onMenuRecall() {
    const message = this.data.currentMessage;
    if (!message) return;

    // 检查消息是否可撤回（2分钟内）
    const sendTime = message.sendTime ? new Date(message.sendTime).getTime() : message.timestamp;
    const timeDiff = (Date.now() - sendTime) / 1000;
    if (timeDiff > 120) {
      wx.showToast({ title: '消息已超过2分钟，无法撤回', icon: 'none' });
      this.hideMenu();
      return;
    }

    const openid = this.getUserInfo().openId;
    
    // 本地立即更新UI - 将原消息替换为系统消息
    const messageList = this.data.messageList;
    let recallIndex = -1;

    for (let i = 0; i < messageList.length; i++) {
      if (messageList[i].id === message.id && !messageList[i].isSystem) {
        recallIndex = i;
        break;
      }
    }

    if (recallIndex !== -1) {
      const newMessageList = [...messageList];
      // 替换为系统消息（不是删除再插入，保持位置不变）
      newMessageList[recallIndex] = {
        id: newMessageList[recallIndex].id, // 保持原ID
        content: '你撤回了一条消息',
        isSystem: true,
        isRecallTip: true,
        recallFor: message.id,
        createTime: newMessageList[recallIndex].createTime,
        timestamp: newMessageList[recallIndex].timestamp,
        sendTime: newMessageList[recallIndex].sendTime,
        _shouldPersist: true
      };
      
      // 重新处理时间标签
      const processedList = this.addTimeTipsToMessages(newMessageList);
      this.setData({ messageList: processedList });
      console.log('本地撤回成功，已替换消息:', message.id);
    }

    this.hideMenu();

    // 发送撤回请求到服务器
    const app = getApp();
    if (this._isConnected) {
      app.sendMessage({
        type: 'recall',
        messageId: message.id,
        to: this.data.receiver_openid,
        sendTime: message.sendTime || new Date(sendTime).toISOString()
      });
    } else {
      wx.showToast({ title: '网络异常，撤回失败', icon: 'none' });
      // 撤回失败，重新加载历史消息恢复状态
      setTimeout(() => {
        this.loadHistoryMessages(openid, this.data.receiver_openid);
      }, 500);
    }
  },

  onMenuDelete() {
    const message = this.data.currentMessage;
    if (!message) return;
    
    // 删除消息（本地删除，不影响服务器）
    const newMessageList = this.data.messageList.filter(msg => msg.id !== message.id);
    // 重新处理时间标签
    const processedList = this.addTimeTipsToMessages(newMessageList);
    this.setData({ messageList: processedList });
    this.hideMenu();
    wx.showToast({ title: '已删除', icon: 'success', duration: 1000 });
  },

  hideMenu() {
    this.setData({ menuVisible: false, currentMessage: null });
  },

  /*———————————————— 滚动控制 ————————————————*/
  scrollToBottom() {
    this.setData({ scrollToView: 'bottom-anchor', scrollTop: 999999 });
  },

  scrollLastMessageToVisible() {
    const messageList = this.data.messageList;
    if (messageList.length === 0 || this.data.keyboardHeight === 0) return;

    const lastMessage = messageList[messageList.length - 1];
    const query = wx.createSelectorQuery();
    query.select(`#msg-${lastMessage.id}`).boundingClientRect();
    query.select('.chat-scroll-view').boundingClientRect();
    query.select('.input-bar-wrapper').boundingClientRect();

    query.exec((res) => {
      const [msgRect, scrollViewRect, inputBarRect] = res;
      if (!msgRect || !scrollViewRect || !inputBarRect) {
        this.scrollToBottom();
        return;
      }

      const inputBarTopRelative = inputBarRect.top - scrollViewRect.top;
      const msgBottomRelative = msgRect.bottom - scrollViewRect.top;
      const targetMsgBottom = inputBarTopRelative - 20;

      if (msgBottomRelative > targetMsgBottom) {
        const needScrollDistance = msgBottomRelative - targetMsgBottom;
        const query2 = wx.createSelectorQuery();
        query2.select('.chat-scroll-view').scrollOffset();
        query2.exec((scrollRes) => {
          const currentScrollTop = scrollRes[0]?.scrollTop || 0;
          this.setData({ scrollTop: currentScrollTop + needScrollDistance });
        });
      }
    });
  },

  calculateScrollViewHeight() {
    const query = wx.createSelectorQuery();
    query.select('.custom-nav').boundingClientRect();
    query.exec((res) => {
      const navHeight = res[0]?.height || 80;
      this.setData({ scrollViewHeight: this.data.windowHeight - navHeight });
    });
  },

  /*———————————————— 输入框事件处理 ————————————————*/
  onInputChange(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onInputFocus(e) {
    const keyboardHeight = e.detail.height || 0;
    this.setData({
      keyboardHeight,
      inputBarBottom: keyboardHeight,
      isKeyboardShow: true
    });
    setTimeout(() => this.scrollLastMessageToVisible(), 300);
  },

  onInputBlur() {
    this.setData({
      keyboardHeight: 0,
      inputBarBottom: 0,
      isKeyboardShow: false
    });
    setTimeout(() => this.scrollToBottom(), 100);
  },

  /*———————————————— UI交互事件 ————————————————*/
  onTapBlank() {
    if (this.data.menuVisible) this.hideMenu();
    wx.hideKeyboard();
  },

  onEmojiClick() {
    wx.showToast({ title: '表情功能开发中', icon: 'none' });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  /*———————————————— 辅助函数 ————————————————*/
  formatMessageTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  },

  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },
});