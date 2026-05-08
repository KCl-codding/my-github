// app.js
const API_CONFIG = require('config/api-config.js');
const GET_OFFLINE_CHAT = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_offline_chat;

App({
  globalData: {
    openId: null,
    token: null,
    socketOpen: false,
    socketTask: null,
    reconnectCount: 0,
    maxReconnectCount: 5,
    heartBeatInterval: null,
    isManualClose: false,

    unreadCountMap: new Map(),
    activityUnreadCount: 0,
    lastReadActivityTime: null,

    isGroup: {}
  },

  onLaunch() {
    console.log('小程序启动');

    // 监听页面切换
    this.watchPageSwitch();

    // 绑定全局 WebSocket 监听器
    this.bindSocketListeners();
    // 检查本地是否有有效的登录信息
    this.tryAutoLoginAndConnect();
    // 加载本地未读消息数
    this.loadUnreadCountFromStorage();
    // 新增：加载活动未读数
    this.loadActivityUnreadFromStorage();
  },

  onShow() {
    // 从后台切回前台时，检查是否需要重连
    if (this.globalData.openId && !this.globalData.socketOpen && !this.globalData.isManualClose) {
      console.log('从后台切回，重新连接 WebSocket');
      this.initWebSocket(this.globalData.openId);
    }

    // 延迟更新tabBar角标，确保页面切换完成
    setTimeout(() => {
      this.updateTabBarBadges();
    }, 100);
  },

  // 监听页面切换
  watchPageSwitch() {
    // 重写 wx.switchTab 方法
    const originalSwitchTab = wx.switchTab;
    wx.switchTab = (options) => {
      console.log('switchTab 到:', options.url);
      originalSwitchTab.call(wx, {
        ...options,
        success: (res) => {
          // 延迟更新角标，等待页面切换完成
          setTimeout(() => {
            this.updateTabBarBadges();
          }, 200);
          if (options.success) {
            options.success(res);
          }
        }
      });
    };

    // 重写 wx.navigateTo 方法
    const originalNavigateTo = wx.navigateTo;
    wx.navigateTo = (options) => {
      originalNavigateTo.call(wx, {
        ...options,
        success: (res) => {
          // 延迟更新角标
          setTimeout(() => {
            this.updateTabBarBadges();
          }, 200);
          if (options.success) {
            options.success(res);
          }
        }
      });
    };

    // 重写 wx.reLaunch 方法
    const originalReLaunch = wx.reLaunch;
    wx.reLaunch = (options) => {
      originalReLaunch.call(wx, {
        ...options,
        success: (res) => {
          setTimeout(() => {
            this.updateTabBarBadges();
          }, 200);
          if (options.success) {
            options.success(res);
          }
        }
      });
    };
  },

  // ========== 活动角标相关方法 ==========

  // 加载活动未读数
  loadActivityUnreadFromStorage() {
    try {
      const activityUnread = wx.getStorageSync('activity_unread_count');
      const lastReadTime = wx.getStorageSync('last_read_activity_time');

      if (activityUnread !== undefined) {
        this.globalData.activityUnreadCount = activityUnread;
      }
      if (lastReadTime) {
        this.globalData.lastReadActivityTime = lastReadTime;
      }

      console.log('加载活动未读数:', this.globalData.activityUnreadCount);
    } catch (e) {
      console.error('加载活动未读数失败:', e);
    }
  },

  // 保存活动未读数
  saveActivityUnreadToStorage() {
    try {
      wx.setStorageSync('activity_unread_count', this.globalData.activityUnreadCount);
      wx.setStorageSync('last_read_activity_time', this.globalData.lastReadActivityTime);
    } catch (e) {
      console.error('保存活动未读数失败:', e);
    }
  },

  // 增加活动未读数
  addActivityUnreadCount(activityTime) {
    // 如果活动发布时间晚于最后阅读时间，才增加未读数
    if (!this.globalData.lastReadActivityTime || activityTime > this.globalData.lastReadActivityTime) {
      this.globalData.activityUnreadCount++;
      this.saveActivityUnreadToStorage();

      // 立即更新角标
      this.updateTabBarBadges();

      console.log(`活动未读数增加: ${this.globalData.activityUnreadCount}`);
      return true;
    }
    return false;
  },

  // 清除活动未读数（进入活动页面时调用）
  clearActivityUnreadCount() {
    if (this.globalData.activityUnreadCount > 0) {
      console.log(`清除活动未读数，原值: ${this.globalData.activityUnreadCount}`);
      this.globalData.activityUnreadCount = 0;
      this.globalData.lastReadActivityTime = new Date().toISOString();
      this.saveActivityUnreadToStorage();

      // 立即更新角标
      this.updateTabBarBadges();
    }
  },

  // 获取活动未读数
  getActivityUnreadCount() {
    return this.globalData.activityUnreadCount;
  },

  // ========== 消息未读数相关方法 ==========

  // 加载本地未读消息数
  loadUnreadCountFromStorage() {
    try {
      const storageMap = wx.getStorageSync('global_chat_unread_map');
      if (storageMap && typeof storageMap === 'object') {
        Object.keys(storageMap).forEach(key => {
          this.globalData.unreadCountMap.set(key, storageMap[key]);
        });
        console.log('加载全局未读消息数:', Array.from(this.globalData.unreadCountMap.entries()));
        this.updateTabBarBadges();
      }
    } catch (e) {
      console.error('加载未读消息数失败:', e);
    }
  },

  // 保存未读消息数到本地
  saveUnreadCountToStorage() {
    try {
      const storageMap = {};
      this.globalData.unreadCountMap.forEach((value, key) => {
        storageMap[key] = value;
      });
      wx.setStorageSync('global_chat_unread_map', storageMap);
    } catch (e) {
      console.error('保存未读消息数失败:', e);
    }
  },

  // 增加未读消息数（支持私聊和群聊）
  addUnreadCount(key) {
    const currentCount = this.globalData.unreadCountMap.get(key) || 0;
    const newCount = currentCount + 1;
    this.globalData.unreadCountMap.set(key, newCount);
    this.saveUnreadCountToStorage();

    // 立即更新角标
    this.updateTabBarBadges();

    console.log(`全局增加未读数: ${key} = ${newCount}, 总未读数: ${this.getTotalUnreadCount()}`);
    return newCount;
  },

  // 清除指定聊天的未读消息数（支持私聊和群聊）
  clearUnreadCount(key) {
    console.log(`准备清除未读数: ${key}`);
    console.log('清除前全局Map:', Array.from(this.globalData.unreadCountMap.entries()));

    if (this.globalData.unreadCountMap.has(key)) {
      this.globalData.unreadCountMap.delete(key);
      this.saveUnreadCountToStorage();

      // 立即更新角标
      this.updateTabBarBadges();

      console.log(`全局清除未读数成功: ${key}`);
      console.log('清除后全局Map:', Array.from(this.globalData.unreadCountMap.entries()));
      console.log('清除后总未读数:', this.getTotalUnreadCount());
    } else {
      console.log(`未找到要清除的未读数: ${key}`);
    }
  },

  // 获取总未读消息数
  getTotalUnreadCount() {
    let total = 0;
    this.globalData.unreadCountMap.forEach((count) => {
      total += count;
    });
    return total;
  },

  // 更新所有tabBar角标
  updateTabBarBadges() {
    // 更新消息角标（第4个tab，索引3）
    const messageUnread = this.getTotalUnreadCount();
    console.log('更新消息角标，未读数:', messageUnread);

    if (messageUnread > 0) {
      wx.setTabBarBadge({
        index: 3,
        text: messageUnread > 99 ? '99+' : messageUnread.toString()
      }).catch(() => {});
    } else {
      wx.removeTabBarBadge({
        index: 3,
      }).catch(() => {});
    }

    // 更新活动角标（第3个tab，索引2）
    const activityUnread = this.globalData.activityUnreadCount;
    console.log('更新活动角标，未读数:', activityUnread);

    if (activityUnread > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: activityUnread > 99 ? '99+' : activityUnread.toString()
      }).catch(() => {});
    } else {
      wx.removeTabBarBadge({
        index: 2
      }).catch(() => {});
    }
  },

  // ========== WebSocket 相关方法 ==========

  bindSocketListeners() {
    // 连接打开
    wx.onSocketOpen(() => {
      console.log('WebSocket已连接');
      this.globalData.socketOpen = true;
      this.globalData.reconnectCount = 0;
      this.startHeartBeat();
      this.pullOfflineMessages();
    });

    // 收到消息
    wx.onSocketMessage((res) => {
      console.log('收到原始消息:', res.data);
      this.handleMessage(res.data);
    });

    // 连接关闭
    wx.onSocketClose(() => {
      console.log('WebSocket已断开');
      this.globalData.socketOpen = false;
      this.stopHeartBeat();

      if (!this.globalData.isManualClose) {
        this.handleReconnect();
      }
    });

    // 连接错误
    wx.onSocketError((err) => {
      console.error('WebSocket错误', err);
      this.globalData.socketOpen = false;
    });
  },

  // 尝试自动登录并建立 WebSocket 连接
  tryAutoLoginAndConnect() {
    const token = wx.getStorageSync('token');
    const expireTime = wx.getStorageSync('tokenExpireTime');
    const openId = wx.getStorageSync('openId');
    const userInfo = wx.getStorageSync('userInfo');

    // 检查 token 是否存在且未过期
    const isTokenValid = token && expireTime && Date.now() < expireTime;

    if (isTokenValid && openId) {
      console.log('检测到已有登录状态，自动建立 WebSocket 连接');

      // 恢复登录状态
      this.globalData.token = token;
      this.globalData.openId = openId;
      this.globalData.isManualClose = false;

      // 直接建立 WebSocket 连接（不需要重新登录）
      this.initWebSocket(openId);

      // 可选：通知所有页面已登录
      this.triggerEvent('autoLoginSuccess', { openId, userInfo });

    } else if (token && expireTime && Date.now() >= expireTime) {
      // token 过期，清理本地数据
      console.log('token 已过期，清理本地缓存');
      this.clearLoginData();
    } else {
      console.log('未登录，等待用户手动登录');
    }
  },

  // 清理登录数据
  clearLoginData() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('tokenExpireTime');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openId');
    this.globalData.openId = null;
    this.globalData.token = null;
  },

  // 登录成功后调用（由主页 Behavior 调用）
  setupWebSocketAfterLogin(openId, token) {
    console.log('登录成功，建立 WebSocket 连接', openId);

    this.globalData.openId = openId;
    this.globalData.token = token;
    this.globalData.isManualClose = false;

    // 存储到本地
    wx.setStorageSync('openId', openId);
    wx.setStorageSync('token', token);

    // 如果之前有连接，先关闭
    if (this.globalData.socketTask) {
      this.closeWebSocket();
    }

    // 建立 WebSocket 连接
    this.initWebSocket(openId);
  },

  // 初始化 WebSocket 连接
  initWebSocket(openId) {
    // 关闭之前的连接（如果有）
    if (this.globalData.socketTask) {
      try {
        wx.closeSocket();
      } catch (e) { }
      this.globalData.socketTask = null;
    }

    const wsUrl = `${API_CONFIG.WSURL}/${openId}`;
    console.log('WebSocket 连接地址:', wsUrl);

    const socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => console.log('WebSocket连接中...'),
      fail: (err) => {
        console.error('WebSocket连接失败', err);
        this.handleReconnect();
      }
    });

    this.globalData.socketTask = socketTask;
  },

  // 重连逻辑
  handleReconnect() {
    if (this.globalData.reconnectCount >= this.globalData.maxReconnectCount) {
      console.log('重连次数已达上限');
      return;
    }

    this.globalData.reconnectCount++;
    const delay = 1000 * Math.pow(2, this.globalData.reconnectCount);

    console.log(`${delay}ms 后尝试第 ${this.globalData.reconnectCount} 次重连`);

    setTimeout(() => {
      if (this.globalData.openId && !this.globalData.socketOpen && !this.globalData.isManualClose) {
        this.initWebSocket(this.globalData.openId);
      }
    }, delay);
  },

  // 心跳
  startHeartBeat() {
    this.stopHeartBeat();
    this.globalData.heartBeatInterval = setInterval(() => {
      if (this.globalData.socketOpen) {
        wx.sendSocketMessage({
          data: 'ping',
          fail: () => console.log('心跳发送失败')
        });
      }
    }, 30000);
  },

  stopHeartBeat() {
    if (this.globalData.heartBeatInterval) {
      clearInterval(this.globalData.heartBeatInterval);
      this.globalData.heartBeatInterval = null;
    }
  },

  async pullOfflineMessages() {
    console.log('拉取离线消息');

    if (!this.globalData.openId) {
      console.log('未登录，跳过拉取离线消息');
      return;
    }

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: GET_OFFLINE_CHAT,
          method: 'POST',
          data: { openid: this.globalData.openId },
          header: { 'content-type': 'application/x-www-form-urlencoded' },
          success: resolve,
          fail: reject
        });
      });

      const offlineData = res.data;
      console.log('离线消息数据:', offlineData);

      if (!offlineData || Object.keys(offlineData).length === 0) {
        console.log('没有离线消息');
        return;
      }

      // 遍历每个发送者的离线消息
      Object.keys(offlineData).forEach(senderOpenid => {
        const messages = offlineData[senderOpenid];
        const count = messages.length;

        // 更新全局未读数
        const currentCount = this.globalData.unreadCountMap.get(senderOpenid) || 0;
        this.globalData.unreadCountMap.set(senderOpenid, currentCount + count);

        console.log(`离线消息: ${senderOpenid} 增加 ${count} 条，总未读 ${currentCount + count}`);
      });

      // 保存到本地存储
      this.saveUnreadCountToStorage();

      // 更新 TabBar 角标
      this.updateTabBarBadges();

      // 触发全局事件，通知各页面刷新
      this.triggerEvent('offlineMessagesLoaded', offlineData);

    } catch (err) {
      console.error('拉取离线消息失败:', err);
    }
  },

  // 发送消息
  sendMessage(data) {
    if (!this.globalData.socketOpen) {
      console.error('WebSocket未连接');
      wx.showToast({ title: '网络连接中，请稍后', icon: 'none' });
      return false;
    }

    wx.sendSocketMessage({
      data: typeof data === 'string' ? data : JSON.stringify(data),
      fail: (err) => {
        console.error('发送失败', err);
        return false;
      }
    });
    return true;
  },

  // 主动关闭（登出时调用）
  closeWebSocket() {
    this.globalData.isManualClose = true;
    this.stopHeartBeat();

    if (this.globalData.socketTask) {
      wx.closeSocket();
      this.globalData.socketTask = null;
    }

    this.globalData.socketOpen = false;
  },

  // 登出
  logout() {
    this.closeWebSocket();
    this.clearLoginData();
    this.globalData.openId = null;
    this.globalData.token = null;
    // 清除消息未读
    this.globalData.unreadCountMap.clear();
    this.saveUnreadCountToStorage();
    // 清除活动未读
    this.globalData.activityUnreadCount = 0;
    this.saveActivityUnreadToStorage();
    this.updateTabBarBadges();
  },

  // 处理收到的消息
  handleMessage(data) {
    console.log('handleMessage 收到:', data);

    // 处理心跳响应
    if (data === 'pong') {
      console.log('心跳响应');
      return;
    }

    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('解析后的消息:', msg);

      if (msg.type === 'activity_exit') {
        this.triggerEvent('activityExit', msg);
        return;
      }
      if (msg.type === 'activity_joined') {
        this.triggerEvent('activityJoined', msg);
        return;
      }
      if (msg.type === 'activity_cancelled') {
        this.triggerEvent('activityCancelled', msg);
        return;
      }
      if (msg.type === 'create_group_success') {
        this.triggerEvent('createGroupSuccess', msg);
        return;
      }
       if (msg.type === 'group_countdown_start') {
        this.triggerEvent('newGroup', msg);
        return;
      }
      // 处理群聊新消息
      if (msg.type === 'new_message_group') {
        // 群聊未读数使用 group_${groupUuid} 作为key
        const groupKey = `group_${msg.groupUuid}`;
        this.addUnreadCount(groupKey);
        this.triggerEvent('newMessageGroup', msg);
        return;
      }

      // 处理群聊撤回消息
      if (msg.type === 'recall_message_group') {
        this.triggerEvent('recallMessageGroup', msg);
        return;
      }

      // 处理私聊撤回消息
      if (msg.type === 'message_recalled') {
        this.triggerEvent('messageRecalled', msg);
        this.triggerEvent('newMessage', msg);
        return;
      }

      // 处理活动消息
      if (msg.type === 'new_activity' && msg.activity) {
        // 增加活动未读数
        this.addActivityUnreadCount(msg.activity.publishTime);
        // 触发活动事件
        this.triggerEvent('newActivity', msg);
        return;
      }

      // 普通私聊消息，增加全局未读消息数
      if (msg.from&&
        msg.from !== this.globalData.openId){
        this.addUnreadCount(msg.from);
      }

      // 触发全局新消息事件，通知所有页面
      this.triggerEvent('newMessage', msg);
    } catch (e) {
      console.log('收到非JSON消息:', data);
    }
  },

  // 简单事件系统
  eventListeners: {},

  onEvent(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  },

  offEvent(eventName, callback) {
    if (this.eventListeners[eventName]) {
      const index = this.eventListeners[eventName].indexOf(callback);
      if (index > -1) this.eventListeners[eventName].splice(index, 1);
    }
  },

  triggerEvent(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error('事件回调执行错误:', e);
        }
      });
    }
  },

  // 获取连接状态
  getSocketStatus() {
    return this.globalData.socketOpen;
  }
});