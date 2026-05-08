/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_WHO_CHAT = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_who_chat;
const GET_LIST_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_list_consumer;
const GET_LAST_CHAT = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_last_chat;

Page({
  behaviors: [loginTipBehavior],

  data: {
    openid: null,
    openid_list: null,
    chat_list: null,
    last_chat_list: null
  },

  // 独立存储未读消息数
  unreadCountMap: new Map(),

  onLoad(options) {
    // 绑定事件处理函数
    this.onNewMessage = this.onNewMessage.bind(this);
    this.onMessageRecalled = this.onMessageRecalled.bind(this);

    // 监听全局新消息事件
    const app = getApp();
    app.onEvent('newMessage', this.onNewMessage);
    app.onEvent('messageRecalled', this.onMessageRecalled);
    app.onEvent('offlineMessagesLoaded', this.onOfflineMessagesLoaded.bind(this));
    // 加载本地未读消息数
    this.loadUnreadCountMap();

    // 初始化页面
    this.initChatPage();

    
  },

  onUnload() {
    console.log('message页面 onUnload');

    // 页面卸载时移除事件监听
    const app = getApp();
    app.offEvent('newMessage', this.onNewMessage);
    app.offEvent('messageRecalled', this.onMessageRecalled);
 app.offEvent('offlineMessagesLoaded', this.onOfflineMessagesLoaded);
    // 离开消息页面时，重新计算并更新角标
    setTimeout(() => {
      app.updateTabBarBadge();
    }, 100);
   
  },

  // 每次显示页面时刷新数据并清除tabBar角标
  onShow() {
    console.log('message页面 onShow');

    if (this.data.openid) {
      this.refreshChatList();
    }

    // 进入消息页面时，清除tabBar角标
    this.clearTabBarBadge();

    // 确保本地未读数与全局同步
    this.syncUnreadCountFromGlobal();
  },

  onHide() {
    console.log('message页面 onHide');

    // 离开消息页面时，重新计算并更新角标
    const app = getApp();
    setTimeout(() => {
      app.updateTabBarBadge();
    }, 100);
  },

  // 清除tabBar角标
  clearTabBarBadge() {
    // 离开消息页面时，重新计算并更新角标
    const app = getApp();
    setTimeout(() => {
      app.updateTabBarBadge();
    }, 100);
  },

  // ==================== 未读消息数管理 ====================

  // 保存未读消息数到内存和本地
  saveUnreadCount(openid, count) {
    this.unreadCountMap.set(openid, count);

    // 保存到本地存储
    this.saveAllUnreadCountToStorage();

    console.log(`保存未读数: ${openid} = ${count}`);
  },

  // 获取未读消息数
  getUnreadCount(openid) {
    const count = this.unreadCountMap.get(openid) || 0;
    return count;
  },

  // 清除未读消息数（本地）
  clearUnreadCount(openid) {
    // 清除本地未读数
    this.saveUnreadCount(openid, 0);
    this.updateChatListMessageField(openid, 0);
    console.log(`清除本地未读数: ${openid}`);
  },

  // 加载本地未读消息数
  loadUnreadCountMap() {
    try {
      const app = getApp();
      const storageMap = wx.getStorageSync(app.getStorageKey('chat_unread_map'));  // 加前缀
      if (storageMap && typeof storageMap === 'object') {
        this.unreadCountMap.clear();
        Object.keys(storageMap).forEach(key => {
          this.unreadCountMap.set(key, storageMap[key]);
        });
        console.log('加载本地未读消息数:', Array.from(this.unreadCountMap.entries()));
      }
    } catch (e) {
      console.error('加载未读消息数失败:', e);
    }
  },
  // 保存所有未读数到本地
  saveAllUnreadCountToStorage() {
    try {
      const storageMap = {};
      this.unreadCountMap.forEach((value, key) => {
        storageMap[key] = value;
      });
      const app = getApp();
      wx.setStorageSync(app.getStorageKey('chat_unread_map'), storageMap);  // 加前缀
    } catch (e) {
      console.error('保存未读消息数失败:', e);
    }
  },

  // 从全局同步未读数到本地
  syncUnreadCountFromGlobal() {
    const app = getApp();
    const globalMap = app.globalData.unreadCountMap;

    console.log('=== 同步未读数开始 ===');
    console.log('同步前本地Map:', Array.from(this.unreadCountMap.entries()));
    console.log('全局Map:', Array.from(globalMap.entries()));

    // 清空本地Map
    this.unreadCountMap.clear();

    // 同步全局数据到本地
    globalMap.forEach((count, openid) => {
      this.unreadCountMap.set(openid, count);
    });

    // 保存到本地存储
    this.saveAllUnreadCountToStorage();

    // 更新聊天列表显示
    if (this.data.chat_list) {
      this.syncAllUnreadCountToChatList();
    }

    console.log('同步后本地Map:', Array.from(this.unreadCountMap.entries()));
    console.log('=== 同步未读数结束 ===');
  },

  // 更新聊天列表中的 message 字段
  updateChatListMessageField(openid, count) {
    if (!this.data.chat_list) return;

    const chat_list = [...this.data.chat_list];
    let hasUpdate = false;

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].openid === openid) {
        chat_list[i] = {
          ...chat_list[i],
          message: count
        };
        hasUpdate = true;
        break;
      }
    }

    if (hasUpdate) {
      this.setData({ chat_list });
    }
  },

  // 更新所有聊天列表的 message 字段（从 unreadCountMap 同步）
  syncAllUnreadCountToChatList() {
    if (!this.data.chat_list) return;

    const chat_list = [...this.data.chat_list];
    let hasUpdate = false;

    for (let i = 0; i < chat_list.length; i++) {
      const openid = chat_list[i].openid;
      const unreadCount = this.getUnreadCount(openid);

      if (chat_list[i].message !== unreadCount) {
        chat_list[i] = {
          ...chat_list[i],
          message: unreadCount
        };
        hasUpdate = true;
      }
    }

    if (hasUpdate) {
      this.setData({ chat_list });
      console.log('同步未读数完成');
    }
  },

  // ==================== 消息处理 ====================

  // 收到新消息的回调（由全局事件触发）
  onNewMessage(msg) {
    console.log('message页面收到消息:', msg);

    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析消息失败:', e);
        return;
      }
    }
    // 关键修复：过滤撤回消息，不当作新消息处理
    if (messageData.type === 'message_recalled') {
      console.log('收到撤回消息，不当作新消息处理');
      return;
    }

    // 增加本地未读消息数
    const currentCount = this.getUnreadCount(messageData.from);
    const newCount = currentCount + 1;
    this.saveUnreadCount(messageData.from, newCount);
    console.log(`更新本地未读数: ${messageData.from} = ${newCount}`);

    // 更新聊天列表显示
    this.updateOrCreateChatItem(messageData.from, newCount, messageData);
  },

  // 处理撤回消息回调
  onMessageRecalled(recallData) {
    console.log('message页面处理撤回消息:', recallData);
    this.handleMessageRecalled(recallData);
  },
  // 处理撤回消息
  handleMessageRecalled(recallData) {
    console.log('处理撤回消息:', recallData);

    // 获取被撤回的消息ID和聊天对象
    const recalledMessageId = recallData.messageId;
    let targetOpenid = recallData.chatPartner;

    // 如果没有提供chatPartner，尝试从聊天列表中查找
    if (!targetOpenid && recalledMessageId && this.data.chat_list) {
      for (let i = 0; i < this.data.chat_list.length; i++) {
        const chat = this.data.chat_list[i];
        if (chat.last_message && chat.last_message.id == recalledMessageId) {
          targetOpenid = chat.openid;
          console.log('通过messageId找到聊天对象:', targetOpenid);
          break;
        }
      }
    }

    if (!targetOpenid) {
      console.log('无法确定撤回消息的聊天对象，刷新整个列表');
      this.refreshChatList();
      return;
    }

    // 更新对应聊天的最后一条消息
    if (!this.data.chat_list) return;

    const chat_list = [...this.data.chat_list];
    let found = false;

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].openid === targetOpenid) {
        // 检查是否是最后一条消息被撤回
        if (chat_list[i].last_message && chat_list[i].last_message.id == recalledMessageId) {
          // 将最后一条消息内容替换为撤回提示
          chat_list[i] = {
            ...chat_list[i],
            last_message: {
              ...chat_list[i].last_message,
              content: '对方撤回了一条消息',
              isRecalled: true
            }
          };
          found = true;
          console.log(`更新聊天 ${chat_list[i].nickname} 的最后一条消息为撤回提示`);
        } else {
          console.log('撤回的消息不是最后一条，无需更新显示');
          return;
        }
        break;
      }
    }

    if (found) {
      this.setData({ chat_list });
    }
  },
  // 格式化消息内容显示
  formatMessageContent(messageData) {
    // 根据消息类型格式化显示内容
    switch (messageData.messageType) {
      case 1: // 文本消息
        return messageData.content || '[文本消息]';
      case 2: // 图片消息
        return '[图片]';
      case 3: // 语音消息
        return '[语音]';
      case 4: // 视频消息
        return '[视频]';
      default:
        return messageData.content || '[新消息]';
    }
  },
  // 格式化消息时间
  formatMessageTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  },
  formatShortTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (msgDate.getTime() === today.getTime()) {
      return `${hours}:${minutes}`;
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `昨天 ${hours}:${minutes}`;
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  },
  // 更新或创建聊天项
  updateOrCreateChatItem(openid, unreadCount, messageData) {
    // 如果聊天列表为空，先刷新
    if (!this.data.chat_list || this.data.chat_list.length === 0) {
      console.log('聊天列表为空，先刷新列表');
      this.refreshChatList().then(() => {
        this.updateOrCreateChatItem(openid, unreadCount, messageData);
      });
      return;
    }

    const chat_list = [...this.data.chat_list];
    let found = false;

    // 格式化消息内容
    let displayContent = this.formatMessageContent(messageData);

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].openid === openid) {
        // 更新现有聊天
        chat_list[i] = {
          ...chat_list[i],
          message: unreadCount,
          last_message: {
            id: messageData.id,
            content: displayContent,
            sendTime: messageData.time,
            sendTimeFormat: this.formatMessageTime(messageData.time),
            sendTimeShort: this.formatShortTime(messageData.time),
            messageType: messageData.messageType,
            isRead: false,
            senderOpenid: messageData.from,
            isRecalled: false
          }
        };
        found = true;
        console.log(`更新聊天 ${chat_list[i].nickname} 的未读数为: ${unreadCount}`);
        break;
      }
    }

    if (!found) {
      // 创建新聊天（先添加占位）
      console.log('创建新聊天记录');
      const newChatItem = {
        openid: openid,
        nickname: '加载中...',
        avatarUrl: '/images/default-avatar.png',
        message: unreadCount,
        last_message: {
          id: messageData.id,
          content: displayContent,
          sendTime: messageData.time,
          sendTimeFormat: this.formatMessageTime(messageData.time),
          sendTimeShort: this.formatShortTime(messageData.time),
          messageType: messageData.messageType,
          isRead: false,
          senderOpenid: messageData.from,
          isRecalled: false
        }
      };
      chat_list.push(newChatItem);

      // 异步获取用户信息
      this.getUserInfoByOpenid(openid).then(userInfo => {
        const currentList = [...this.data.chat_list];
        const index = currentList.findIndex(item => item.openid === openid);
        if (index !== -1) {
          currentList[index] = {
            ...currentList[index],
            nickname: userInfo.nickname || '微信用户',
            avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png'
          };
          this.setData({ chat_list: currentList });
        }
      }).catch(err => {
        console.error('获取用户信息失败:', err);
        const currentList = [...this.data.chat_list];
        const index = currentList.findIndex(item => item.openid === openid);
        if (index !== -1) {
          currentList[index].nickname = '微信用户';
          this.setData({ chat_list: currentList });
        }
      });
    }

    // 重新排序
    const updatedList = this.sortChatList(chat_list);
    this.setData({ chat_list: updatedList });
    console.log('更新后的聊天列表:', updatedList.map(item => ({
      nickname: item.nickname,
      message: item.message
    })));
  },
  // 根据 openid 获取用户信息
  getUserInfoByOpenid(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_LIST_CONSUMER,
        method: 'POST',
        header: {
          'content-type': 'application/json',
        },
        data: [openid],
        success: (res) => {
          console.log('获取用户信息响应:', res.data);
          if (res.data && res.data.data && res.data.data.length > 0) {
            resolve(res.data.data[0]);
          } else {
            reject('未找到用户信息');
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },
  // 排序聊天列表
  sortChatList(chat_list) {
    if (!chat_list || chat_list.length === 0) return chat_list;

    return chat_list.sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
    });
  },

  // ==================== 页面数据加载 ====================

  // 刷新聊天列表
  async refreshChatList() {
    if (!this.data.openid) return;

    this.showLoading();
    await this.getWhoChat(this.data.openid);
    // 同步未读数
    this.syncAllUnreadCountToChatList();
    this.hideLoading();
  },

  async initChatPage() {
    await this.getOpenid();
    if (this.data.openid) {
      await this.getWhoChat(this.data.openid);
      this.syncAllUnreadCountToChatList();
    }
  },

  getOpenid() {
    return new Promise((resolve) => {
      if (!this.checkLogin()) {
        this.showLoginTip();
        resolve(null);
        return;
      }

      this.showLoading();
      const userInfo = this.getUserInfo();
      this.setData({
        openid: userInfo.openId
      });
      resolve(userInfo.openId);
    });
  },

  getWhoChat(openid) {
    return new Promise((resolve, reject) => {
      if (!openid) {
        return;
      }

      wx.request({
        url: GET_WHO_CHAT,
        method: 'POST',
        header: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        data: {
          openid: openid
        },
        success: async (res) => {
          console.log('获取聊天对象列表:', res.data);

          let openid_list = Array.isArray(res.data) ? res.data : [];

          this.setData({
            openid_list: openid_list
          });

          await Promise.all([
            this.getChatListInfo(openid_list),
            this.getLastChat(openid_list)
          ]);

          const mergedList = this.mergeChatData();
          this.setData({
            chat_list: mergedList
          });

          this.hideLoading();
          resolve();
        },
        fail: (err) => {
          console.error('获取聊天对象失败:', err);
          this.hideLoading();
          reject(err);
        }
      });
    });
  },

  getChatListInfo(openid_list) {
    return new Promise((resolve, reject) => {
      if (!openid_list || openid_list.length === 0) {
        console.warn('openid_list 为空');
        resolve([]);
        return;
      }

      wx.request({
        url: GET_LIST_CONSUMER,
        method: 'POST',
        header: {
          'content-type': 'application/json',
        },
        data: openid_list,
        success: (res) => {
          console.log('用户信息列表:', res.data.data);
          let chatList = Array.isArray(res.data.data) ? res.data.data : [];
          this.setData({
            chat_list: chatList
          });
          resolve(chatList);
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  },

  getLastChat(openid_list) {
    return new Promise((resolve, reject) => {
      if (!openid_list || openid_list.length === 0) {
        console.warn('openid_list 为空');
        resolve([]);
        return;
      }

      wx.request({
        url: GET_LAST_CHAT + '/' + this.getUserInfo().openId,
        method: 'POST',
        header: {
          'content-type': 'application/json',
        },
        data: openid_list,
        success: (res) => {
          console.log('最后聊天记录:', res.data);

          let lastChatArray = [];
          if (res.data && typeof res.data === 'object') {
            if (!Array.isArray(res.data)) {
              lastChatArray = Object.keys(res.data)
                .filter(key => res.data[key] !== null)
                .map(key => {
                  const message = res.data[key];
                  return {
                    openid: message.openid || key,
                    ...message
                  };
                });
            } else {
              lastChatArray = res.data;
            }
          }

          console.log('转换后的最后聊天记录:', lastChatArray);
          this.setData({
            last_chat_list: lastChatArray
          });
          resolve(lastChatArray);
        },
        fail: (err) => {
          console.error('获取最后聊天记录失败:', err);
          reject(err);
        }
      });
    });
  },

  // 合并聊天列表数据
  mergeChatData() {
    const { chat_list, last_chat_list } = this.data;

    if (!chat_list || !Array.isArray(chat_list)) return [];
    if (!last_chat_list || !Array.isArray(last_chat_list)) return chat_list;

    // 创建 last_chat 的映射表
    const lastChatMap = new Map();
    last_chat_list.forEach(chat => {
      if (chat && chat.openid) {
        lastChatMap.set(chat.openid, chat);
      }
    });

    // 合并数据
    const mergedList = chat_list.map(user => {
      const lastChat = lastChatMap.get(user.openid);

      // 从独立存储获取未读数
      const unreadCount = this.getUnreadCount(user.openid);

      if (lastChat) {
        // 格式化消息内容
        let displayContent = lastChat.content;
        if (lastChat.isRecalled) {
          displayContent = '对方撤回了一条消息';
        } else if (lastChat.messageType === 2) {
          displayContent = '[图片]';
        } else if (lastChat.messageType === 3) {
          displayContent = '[语音]';
        } else if (lastChat.messageType === 4) {
          displayContent = '[视频]';
        }

        return {
          ...user,
          message: unreadCount,
          last_message: {
            id: lastChat.id,
            content: displayContent,
            sendTime: lastChat.sendTime,
            sendTimeFormat: this.formatMessageTime(lastChat.sendTime),
            sendTimeShort: this.formatShortTime(lastChat.sendTime),
            messageType: lastChat.messageType,
            isRead: lastChat.isRead,
            isRecalled: lastChat.isRecalled,
            senderOpenid: lastChat.senderOpenid
          }
        };
      }

      return {
        ...user,
        message: unreadCount,
        last_message: null
      };
    });

    // 排序
    mergedList.sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
    });

    console.log('合并后的聊天列表:', mergedList.map(item => ({
      nickname: item.nickname,
      message: item.message
    })));

    return mergedList;
  },

  // ==================== 页面交互 ====================

  onChatTap(e) {
    const user = e.currentTarget.dataset.user;
    const currentUnread = this.getUnreadCount(user.openid);

    if (currentUnread > 0) {
      // 1. 清除本地未读数
      this.clearUnreadCount(user.openid);

      // 2. 清除全局未读数
      const app = getApp();
      app.clearUnreadCount(user.openid);

      // 3. 强制更新 tabbar 角标（延迟执行，确保页面切换完成）
      setTimeout(() => {
        app.updateTabBarBadge();
      }, 200);

      // 4. 重新同步（确保一致）
      this.syncUnreadCountFromGlobal();
    }

    wx.navigateTo({
      url: '/pages/chat-ui/chat-ui',
      success: (res) => {
        res.eventChannel.emit('sendData', {
          one_consumer: user
        });
      }
    });
  },

  onOfflineMessagesLoaded(offlineData) {
    console.log('收到离线消息数据，刷新列表', offlineData);

    // 重新同步未读数（app 已经更新了 globalData）
    this.syncUnreadCountFromGlobal();
  },
});