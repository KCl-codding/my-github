/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_WHO_CHAT = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_who_chat;
const GET_LIST_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_list_consumer;
const GET_LAST_CHAT = API_CONFIG.MESSAGE_URL + API_CONFIG.MESSAGE.get_last_chat;
const GET_OPENID_GROUP = API_CONFIG.MESSAGE_URL + API_CONFIG.GROUP.get_openid_group;
const GET_CONSUMER_URL = API_CONFIG.BASE_URL + API_CONFIG.USER.get_join_url;
const GET_LAST_GROUP_MESSAGE = API_CONFIG.MESSAGE_URL + API_CONFIG.GROUP.get_last_group_message;
const GET_ONE_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_one_consumer;

Page({
  behaviors: [loginTipBehavior],

  data: {
    openid: null,
    openid_list: null,
    chat_list: [],           // 最终显示的聊天列表（前缓冲区）
    last_chat_list: null,
    group_list: [],
    isPageReady: false,
    refresherTriggered: false,
    islogin: null
  },

  // 独立存储未读消息数
  unreadCountMap: new Map(),
  
  // ==================== 双缓冲区 ====================
  // 后台缓冲区 - 在此构建完整的聊天列表
  backBufferChatList: [],
  backBufferGroupItems: [],
  
  // 标志位
  isRendering: false,        // 是否正在渲染到前缓冲区
  needRender: false,         // 是否需要重新渲染
  
  // 原有变量
  mergeTimer: null,
  isLoading: false,
  isMerging: false,
  needMerge: false,

  onLoad(options) {
    // 绑定事件处理函数
    this.onNewMessage = this.onNewMessage.bind(this);
    this.onMessageRecalled = this.onMessageRecalled.bind(this);
    this.onNewMessageGroup = this.onNewMessageGroup.bind(this);
    this.onRecallMessageGroup = this.onRecallMessageGroup.bind(this);
    this.onCreateGroupSuccess = this.onCreateGroupSuccess.bind(this);

    // 监听全局新消息事件
    const app = getApp();
    app.onEvent('newMessage', this.onNewMessage);
    app.onEvent('messageRecalled', this.onMessageRecalled);
    app.onEvent('offlineMessagesLoaded', this.onOfflineMessagesLoaded.bind(this));
    app.onEvent('newMessageGroup', this.onNewMessageGroup);
    app.onEvent('recallMessageGroup', this.onRecallMessageGroup);
    app.onEvent('createGroupSuccess', this.onCreateGroupSuccess);

    // 加载本地未读消息数
    this.loadUnreadCountMap();

    // 初始化页面
    this.initChatPage();
  },

  onUnload() {
    console.log('message页面 onUnload');

    if (this.mergeTimer) {
      clearTimeout(this.mergeTimer);
      this.mergeTimer = null;
    }

    const app = getApp();
    app.offEvent('newMessage', this.onNewMessage);
    app.offEvent('messageRecalled', this.onMessageRecalled);
    app.offEvent('offlineMessagesLoaded', this.onOfflineMessagesLoaded);
    app.offEvent('newMessageGroup', this.onNewMessageGroup);
    app.offEvent('recallMessageGroup', this.onRecallMessageGroup);

    setTimeout(() => {
      app.updateTabBarBadges();
    }, 100);
  },

  onShow() {
    console.log('message页面 onShow');
    
    if (!this.checkLogin()) {
      console.log('未登录，不显示消息列表');
      this.setData({
        chat_list: [],
        group_list: [],
        openid: null,
        islogin: 'noLogin',
        isPageReady: true
      });
      return;
    }
    
    console.log("已登录，刷新消息列表");
    
    if (!this.data.openid) {
      const userInfo = this.getUserInfo();
      if (userInfo && userInfo.openId) {
        this.setData({ openid: userInfo.openId });
      }
    }
    
    if (this.data.islogin === 'noLogin') {
      this.refreshAllData();
      this.setData({
        islogin: 'Login'
      });
    }
    
    this.clearTabBarBadge();
    this.syncUnreadCountFromGlobal();
  },

  onHide() {
    console.log('message页面 onHide');
    const app = getApp();
    setTimeout(() => {
      app.updateTabBarBadges();
    }, 100);
  },

  async onPullDownRefresh() {
    console.log('message页面 onPullDownRefresh');

    try {
      await this.refreshAllData();
      wx.stopPullDownRefresh();
    } catch (error) {
      console.error('下拉刷新失败:', error);
      wx.stopPullDownRefresh();
    }
  },

  async onScrollViewRefresh() {
    console.log('scroll-view 下拉刷新');
    this.setData({ refresherTriggered: true });

    try {
      await this.refreshAllData();
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      this.hideLoading();
      this.setData({ refresherTriggered: false });
    }
  },

  // ==================== 双缓冲核心方法 ====================
  
  /**
   * 开始构建后台缓冲区
   * 调用此方法后，所有数据更新都在后台进行，不会触发界面刷新
   */
  beginBufferBuild() {
    // 清空后台缓冲区
    this.backBufferChatList = [];
    this.backBufferGroupItems = [];
    
    // 复制当前的群聊项到后台缓冲区（作为基础）
    if (this.groupChatItems && this.groupChatItems.length > 0) {
      this.backBufferGroupItems = JSON.parse(JSON.stringify(this.groupChatItems));
    }
  },
  
  /**
   * 提交后台缓冲区到前台
   * 一次性将后台构建好的数据渲染到界面上
   */
  commitBuffer() {
    if (this.isRendering) {
      this.needRender = true;
      return;
    }
    
    this.isRendering = true;
    this.needRender = false;
    
    try {
      // 将后台缓冲区的内容一次性赋值到前台
      this.groupChatItems = this.backBufferGroupItems;
      
      // 合并所有聊天项（私聊 + 群聊）
      const allChats = [...this.backBufferChatList, ...this.backBufferGroupItems];
      
      // 排序
      allChats.sort((a, b) => {
        if (!a.last_message && !b.last_message) return 0;
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
      });
      
      // 去重
      const uniqueMap = new Map();
      for (const chat of allChats) {
        let key;
        if (chat.chatType === 'group') {
          key = `group_${chat.groupUuid}`;
        } else {
          key = `private_${chat.openid}`;
        }
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, chat);
        }
      }
      
      const finalChatList = Array.from(uniqueMap.values());
      
      // 一次性更新界面
      this.setData({ chat_list: finalChatList });
      
      console.log(`双缓冲提交完成: 私聊${this.backBufferChatList.length}个, 群聊${this.backBufferGroupItems.length}个`);
      
    } catch (err) {
      console.error('提交缓冲区失败:', err);
    } finally {
      this.isRendering = false;
      if (this.needRender) {
        this.commitBuffer();
      }
    }
  },
  
  /**
   * 更新后台缓冲区的私聊项
   */
  updateBackBufferPrivateChat(openid, chatData) {
    const index = this.backBufferChatList.findIndex(item => 
      item.chatType !== 'group' && item.openid === openid
    );
    
    if (index !== -1) {
      this.backBufferChatList[index] = { ...this.backBufferChatList[index], ...chatData };
    } else {
      this.backBufferChatList.push({
        chatType: 'private',
        openid: openid,
        ...chatData
      });
    }
  },
  
  /**
   * 更新后台缓冲区的群聊项
   */
  updateBackBufferGroupChat(groupUuid, chatData) {
    const index = this.backBufferGroupItems.findIndex(item => 
      item.groupUuid === groupUuid
    );
    
    if (index !== -1) {
      this.backBufferGroupItems[index] = { ...this.backBufferGroupItems[index], ...chatData };
    } else {
      this.backBufferGroupItems.push({
        chatType: 'group',
        groupUuid: groupUuid,
        ...chatData
      });
    }
  },

  // 刷新所有数据（使用双缓冲）
  async refreshAllData() {
    this.showLoading();
    if (!this.checkLogin()) {
      console.log('未登录，不刷新数据');
      return;
    }
    
    if (!this.data.openid) {
      const openid = await this.getOpenid();
      if (!openid) return;
    }

    console.log('开始刷新消息数据（双缓冲模式）');
  
    // 开始构建后台缓冲区
    this.beginBufferBuild();
    
    try {
      // 并行加载私聊和群聊数据，所有数据都在后台缓冲区构建
      await Promise.all([
        this.loadPrivateChatsToBuffer(),
        this.loadGroupChatsToBuffer()
      ]);
      
      // 同步未读消息数到后台缓冲区
      this.syncUnreadCountToBuffer();
      
      // 一次性提交缓冲区到界面
      this.commitBuffer();
      
      console.log('消息数据刷新完成（双缓冲）');
    } catch (error) {
      console.error('刷新数据失败:', error);
    } finally {
      this.hideLoading();
    }
  },
  
  // 将私聊加载到后台缓冲区
  async loadPrivateChatsToBuffer() {
    return new Promise(async (resolve) => {
      if (!this.data.openid) {
        resolve();
        return;
      }

      try {
        const openid_list = await this.requestWhoChat();
        this.setData({ openid_list: openid_list });

        if (!openid_list || openid_list.length === 0) {
          this.backBufferChatList = [];
          resolve();
          return;
        }

        const [chatListInfo, lastChatInfo] = await Promise.all([
          this.requestChatListInfo(openid_list),
          this.requestLastChat(openid_list)
        ]);

        // 构建私聊数据到后台缓冲区
        this.buildPrivateChatsToBuffer(chatListInfo, lastChatInfo);
        resolve();
      } catch (error) {
        console.error('加载私聊失败:', error);
        resolve();
      }
    });
  },
  
  // 构建私聊数据到后台缓冲区
  buildPrivateChatsToBuffer(chatListInfo, lastChatInfo) {
    if (!chatListInfo || !Array.isArray(chatListInfo)) return;
    
    const lastChatMap = new Map();
    if (lastChatInfo && Array.isArray(lastChatInfo)) {
      lastChatInfo.forEach(chat => {
        if (chat && chat.openid) {
          lastChatMap.set(chat.openid, chat);
        }
      });
    }
    
    for (const user of chatListInfo) {
      const lastChat = lastChatMap.get(user.openid);
      const unreadCount = this.getUnreadCount(user.openid);
      
      const chatItem = {
        ...user,
        chatType: 'private',
        message: unreadCount
      };
      
      if (lastChat) {
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
        
        chatItem.last_message = {
          id: lastChat.id,
          content: displayContent,
          sendTime: lastChat.sendTime,
          sendTimeFormat: this.formatMessageTime(lastChat.sendTime),
          sendTimeShort: this.formatShortTime(lastChat.sendTime),
          messageType: lastChat.messageType,
          isRead: lastChat.isRead,
          isRecalled: lastChat.isRecalled,
          senderOpenid: lastChat.senderOpenid
        };
      } else {
        chatItem.last_message = null;
      }
      
      this.backBufferChatList.push(chatItem);
    }
    
    // 排序后台缓冲区的私聊列表
    this.backBufferChatList.sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
    });
  },
  
  // 将群聊加载到后台缓冲区
  async loadGroupChatsToBuffer() {
    try {
      const groupList = await this.getMyGroups(this.data.openid);
      this.setData({ group_list: groupList });

      if (groupList.length === 0) {
        this.backBufferGroupItems = [];
        return;
      }

      // 构建群聊基础数据到后台缓冲区
      for (const group of groupList) {
        const key = `group_${group.groupUuid}`;
        const unreadCount = this.getUnreadCount(key);
        
        const memberAvatars = (group.memberAvatars || [])
          .map(item => item.avatarUrl || item)
          .filter(url => url && url.length > 0);
        
        this.backBufferGroupItems.push({
          chatType: 'group',
          groupUuid: group.groupUuid,
          groupName: group.groupName,
          groupMembers: group.groupMembers,
          openid: null,
          nickname: group.groupName,
          memberAvatars: memberAvatars,
          avatarUrl: '/images/group-default-avatar.png',
          message: unreadCount,
          memberCount: group.groupMembers ? group.groupMembers.length : 0,
          last_message: null
        });
      }
      
      // 获取每个群聊的最后一条消息（直接更新到后台缓冲区）
      await this.getGroupLastMessagesToBuffer(groupList);
      
      // 获取群成员头像（直接更新到后台缓冲区）
      for (const group of groupList) {
        const openidList = group.groupMembers?.map(m => m.openid) || [];
        if (openidList.length > 0) {
          await this.getGroupMemberAvatarsToBuffer(group.groupUuid, openidList);
        }
      }
      
    } catch (err) {
      console.error('加载群聊失败:', err);
      this.backBufferGroupItems = [];
    }
  },
  
  // 获取群聊最后消息到后台缓冲区
  async getGroupLastMessagesToBuffer(groupList) {
    if (!groupList || groupList.length === 0) return;

    const groupUuidList = groupList.map(group => group.groupUuid);

    return new Promise((resolve) => {
      wx.request({
        url: GET_LAST_GROUP_MESSAGE,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: groupUuidList,
        success: (res) => {
          let lastMessages = [];
          if (res.data && res.data.data) {
            lastMessages = res.data.data;
          } else if (Array.isArray(res.data)) {
            lastMessages = res.data;
          } else if (typeof res.data === 'object') {
            lastMessages = Object.values(res.data);
          }
          
          this.updateGroupLastMessagesInBuffer(lastMessages);
          resolve();
        },
        fail: (err) => {
          console.error('获取群聊最后消息失败:', err);
          resolve();
        }
      });
    });
  },
  
  // 更新后台缓冲区中的群聊最后消息
  updateGroupLastMessagesInBuffer(lastMessages) {
    if (!lastMessages || lastMessages.length === 0) return;

    const messageMap = new Map();
    lastMessages.forEach(message => {
      if (message && message.groupUuid) {
        messageMap.set(message.groupUuid, message);
      }
    });

    const currentOpenid = this.data.openid;

    for (let i = 0; i < this.backBufferGroupItems.length; i++) {
      const item = this.backBufferGroupItems[i];
      const lastMessage = messageMap.get(item.groupUuid);

      if (lastMessage) {
        let displayContent = lastMessage.content || '';

        const sendTime = lastMessage.sendTime || lastMessage.createTime || lastMessage.time;
        const sendTimeFormat = this.formatMessageTime(sendTime);
        const sendTimeShort = this.formatShortTime(sendTime);

        if (lastMessage.isRecalled) {
          const isSelfMessage = lastMessage.senderOpenid === currentOpenid;
          if (isSelfMessage) {
            displayContent = '你撤回了一条消息';
          } else {
            displayContent = `${lastMessage.fromNickname || '对方'}撤回了消息`;
          }
        } else if (lastMessage.messageType === 2) {
          displayContent = '[图片]';
        } else if (lastMessage.messageType === 3) {
          displayContent = '[语音]';
        } else if (lastMessage.messageType === 4) {
          displayContent = '[视频]';
        } else if (lastMessage.fromNickname && !lastMessage.isRecalled) {
          displayContent = `${lastMessage.fromNickname}: ${displayContent}`;
        }

        this.backBufferGroupItems[i].last_message = {
          id: lastMessage.id,
          content: displayContent,
          sendTime: sendTime,
          sendTimeFormat: sendTimeFormat,
          sendTimeShort: sendTimeShort,
          messageType: lastMessage.messageType,
          isRead: lastMessage.isRead || false,
          isRecalled: lastMessage.isRecalled || false,
          senderOpenid: lastMessage.from || lastMessage.senderOpenid,
          senderNickname: lastMessage.fromNickname
        };
      }
    }
  },
  
  // 获取群成员头像到后台缓冲区
  getGroupMemberAvatarsToBuffer(groupUuid, openidList) {
    return new Promise((resolve) => {
      wx.request({
        url: GET_CONSUMER_URL,
        method: 'POST',
        data: openidList,
        success: (res) => {
          const memberAvatars = res.data.data || [];
          const avatarUrls = memberAvatars
            .map(item => item.avatarUrl || item)
            .filter(url => url && url.length > 0);
          
          const groupIndex = this.backBufferGroupItems.findIndex(item => item.groupUuid === groupUuid);
          if (groupIndex !== -1) {
            this.backBufferGroupItems[groupIndex].memberAvatars = avatarUrls;
          }
          
          // 同时更新 data 中的 group_list（保持同步）
          const groupList = this.data.group_list;
          const groupIdx = groupList.findIndex(g => g.groupUuid === groupUuid);
          if (groupIdx !== -1) {
            groupList[groupIdx].memberAvatars = memberAvatars;
            this.setData({ group_list: groupList });
          }
          
          resolve();
        },
        fail: (err) => {
          console.error('获取群成员头像失败:', err);
          resolve();
        }
      });
    });
  },
  
  // 同步未读消息到后台缓冲区
  syncUnreadCountToBuffer() {
    // 更新私聊未读数
    for (const chat of this.backBufferChatList) {
      const unreadCount = this.getUnreadCount(chat.openid);
      chat.message = unreadCount;
    }
    
    // 更新群聊未读数
    for (const group of this.backBufferGroupItems) {
      const key = `group_${group.groupUuid}`;
      const unreadCount = this.getUnreadCount(key);
      group.message = unreadCount;
    }
  },

  // 获取群聊最后消息（保留原有方法用于实时更新）
  async getGroupLastMessages(groupList) {
    if (!groupList || groupList.length === 0) return;

    const groupUuidList = groupList.map(group => group.groupUuid);

    return new Promise((resolve) => {
      wx.request({
        url: GET_LAST_GROUP_MESSAGE,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: groupUuidList,
        success: (res) => {
          let lastMessages = [];
          if (res.data && res.data.data) {
            lastMessages = res.data.data;
          } else if (Array.isArray(res.data)) {
            lastMessages = res.data;
          } else if (typeof res.data === 'object') {
            lastMessages = Object.values(res.data);
          }

          this.updateGroupChatLastMessages(lastMessages);
          resolve();
        },
        fail: (err) => {
          console.error('获取群聊最后消息失败:', err);
          resolve();
        }
      });
    });
  },

  async updateGroupChatLastMessages(lastMessages) {
    if (!lastMessages || lastMessages.length === 0) return;

    const messageMap = new Map();
    lastMessages.forEach(message => {
      if (message && message.groupUuid) {
        messageMap.set(message.groupUuid, message);
      }
    });

    let hasUpdate = false;
    const currentOpenid = this.data.openid;

    for (let i = 0; i < this.groupChatItems.length; i++) {
      const item = this.groupChatItems[i];
      const lastMessage = messageMap.get(item.groupUuid);

      if (lastMessage) {
        let displayContent = lastMessage.content || '';

        const sendTime = lastMessage.sendTime || lastMessage.createTime || lastMessage.time;
        const sendTimeFormat = this.formatMessageTime(sendTime);
        const sendTimeShort = this.formatShortTime(sendTime);

        if (lastMessage.isRecalled) {
          const isSelfMessage = lastMessage.senderOpenid === currentOpenid;
          if (isSelfMessage) {
            displayContent = '你撤回了一条消息';
          } else {
            let nickName = '对方';
            try {
              const name = await this.getOneConsumer(lastMessage.senderOpenid);
              if (name) nickName = name;
            } catch (err) {
              console.error('获取昵称失败:', err);
            }
            displayContent = `${nickName}撤回了消息`;
          }
        }
        else if (lastMessage.messageType === 2) {
          displayContent = '[图片]';
        } else if (lastMessage.messageType === 3) {
          displayContent = '[语音]';
        } else if (lastMessage.messageType === 4) {
          displayContent = '[视频]';
        }
        else if (lastMessage.fromNickname && !lastMessage.isRecalled) {
          displayContent = `${lastMessage.fromNickname}: ${displayContent}`;
        }

        const newLastMessage = {
          id: lastMessage.id,
          content: displayContent,
          sendTime: sendTime,
          sendTimeFormat: sendTimeFormat,
          sendTimeShort: sendTimeShort,
          messageType: lastMessage.messageType,
          isRead: lastMessage.isRead || false,
          isRecalled: lastMessage.isRecalled || false,
          senderOpenid: lastMessage.from || lastMessage.senderOpenid,
          senderNickname: lastMessage.fromNickname
        };

        if (JSON.stringify(item.last_message) !== JSON.stringify(newLastMessage)) {
          this.groupChatItems[i].last_message = newLastMessage;
          hasUpdate = true;
        }
      }
    }

    if (hasUpdate) {
      this.debouncedMerge();
    }
  },

  clearTabBarBadge() {
    const app = getApp();
    setTimeout(() => {
      app.updateTabBarBadges();
    }, 100);
  },

  // ==================== 未读消息数管理 ====================

  saveUnreadCount(key, count) {
    this.unreadCountMap.set(key, count);
    this.saveAllUnreadCountToStorage();
  },

  getUnreadCount(key) {
    return this.unreadCountMap.get(key) || 0;
  },

  clearUnreadCount(key) {
    this.saveUnreadCount(key, 0);
    this.updateChatListMessageField(key, 0);
  },

  loadUnreadCountMap() {
    try {
      const storageMap = wx.getStorageSync('chat_unread_map');
      if (storageMap && typeof storageMap === 'object') {
        this.unreadCountMap.clear();
        Object.keys(storageMap).forEach(key => {
          this.unreadCountMap.set(key, storageMap[key]);
        });
      }
    } catch (e) {
      console.error('加载未读消息数失败:', e);
    }
  },

  saveAllUnreadCountToStorage() {
    try {
      const storageMap = {};
      this.unreadCountMap.forEach((value, key) => {
        storageMap[key] = value;
      });
      wx.setStorageSync('chat_unread_map', storageMap);
    } catch (e) {
      console.error('保存未读消息数失败:', e);
    }
  },

  syncUnreadCountFromGlobal() {
    const app = getApp();
    const globalMap = app.globalData.unreadCountMap;

    this.unreadCountMap.clear();
    globalMap.forEach((count, key) => {
      this.unreadCountMap.set(key, count);
    });
    this.saveAllUnreadCountToStorage();

    if (this.data.chat_list && this.data.chat_list.length > 0) {
      this.syncAllUnreadCountToChatList();
    }
  },

  updateChatListMessageField(key, count) {
    if (!this.data.chat_list || this.data.chat_list.length === 0) return;

    const chat_list = [...this.data.chat_list];
    let hasUpdate = false;

    for (let i = 0; i < chat_list.length; i++) {
      const item = chat_list[i];
      if (item.openid === key && item.chatType !== 'group') {
        chat_list[i] = { ...item, message: count };
        hasUpdate = true;
        break;
      }
      if (item.chatType === 'group' && item.groupUuid === key) {
        chat_list[i] = { ...item, message: count };
        hasUpdate = true;
        break;
      }
    }

    if (hasUpdate) {
      this.setData({ chat_list });
    }
  },

  syncAllUnreadCountToChatList() {
    if (!this.data.chat_list || this.data.chat_list.length === 0) return;

    const chat_list = [...this.data.chat_list];
    let hasUpdate = false;

    for (let i = 0; i < chat_list.length; i++) {
      const item = chat_list[i];
      const key = item.chatType === 'group' ? `group_${item.groupUuid}` : item.openid;
      const unreadCount = this.getUnreadCount(key);

      if (item.message !== unreadCount) {
        chat_list[i] = { ...item, message: unreadCount };
        hasUpdate = true;
      }
    }

    if (hasUpdate) {
      this.setData({ chat_list });
    }
  },

  // ==================== 消息处理 ====================

  onNewMessage(msg) {
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析消息失败:', e);
        return;
      }
    }
    if (messageData.type === 'message_recalled') {
      return;
    }
    if (messageData.chatType === 'group') {
      const key = `group_${messageData.groupUuid}`;
      const newCount = (this.getUnreadCount(key) || 0) + 1;
      this.saveUnreadCount(key, newCount);
      this.updateOrCreateGroupChatItem(messageData.groupUuid, newCount, messageData);
    } else {
      const currentOpenid = this.getUserInfo().openId;
      const isSelfMessage = messageData.from === currentOpenid;

      if (!isSelfMessage) {
        const newCount = (this.getUnreadCount(messageData.from) || 0) + 1;
        this.saveUnreadCount(messageData.from, newCount);
        this.updateOrCreateChatItem(messageData.from, newCount, messageData);
      } else {
        const currentUnread = this.getUnreadCount(messageData.to) || 0;
        this.updateOrCreateChatItem(messageData.to, currentUnread, messageData);
      }
    }
  },

  onMessageRecalled(recallData) {
    this.handleMessageRecalled(recallData);
  },

  handleMessageRecalled(recallData) {
    const recalledMessageId = recallData.messageId;
    let targetOpenid = recallData.chatPartner;

    if (!targetOpenid && recalledMessageId && this.data.chat_list) {
      for (let i = 0; i < this.data.chat_list.length; i++) {
        const chat = this.data.chat_list[i];
        if (chat.last_message && chat.last_message.id == recalledMessageId) {
          targetOpenid = chat.openid;
          break;
        }
      }
    }

    if (!targetOpenid) {
      this.refreshChatList();
      return;
    }

    if (!this.data.chat_list) return;

    const chat_list = [...this.data.chat_list];
    let found = false;

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].openid === targetOpenid) {
        if (chat_list[i].last_message && chat_list[i].last_message.id == recalledMessageId) {
          chat_list[i] = {
            ...chat_list[i],
            last_message: {
              ...chat_list[i].last_message,
              content: '对方撤回了一条消息',
              isRecalled: true
            }
          };
          found = true;
        }
        break;
      }
    }

    if (found) {
      this.setData({ chat_list });
    }
  },

  onNewMessageGroup(msg) {
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析群聊消息失败:', e);
        return;
      }
    }

    if (messageData.type === 'new_message_group') {
      console.log('收到群聊新消息:', messageData);

      if (!messageData.time && !messageData.sendTime) {
        messageData.time = new Date().toISOString();
      }

      const key = `group_${messageData.groupUuid}`;
      const newCount = (this.getUnreadCount(key) || 0) + 1;
      this.saveUnreadCount(key, newCount);

      this.updateOrCreateGroupChatItem(messageData.groupUuid, newCount, messageData);
    }
  },

  onCreateGroupSuccess(msg) {
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析群聊消息失败:', e);
        return;
      }
    }

    if (messageData.type === 'create_group_success') {
      console.log('群聊创建成功:', messageData);
      this.refreshGroupChatsAfterCreate(messageData);
    }
  },

  async refreshGroupChatsAfterCreate(createData) {
    try {
      this.showLoading({
        title: '刷新群聊列表...'
      });

      // 使用双缓冲重新加载群聊
      await this.loadGroupChatsToBuffer();
      this.commitBuffer();

      wx.showToast({
        title: '群聊已创建',
        icon: 'success',
        duration: 1500
      });

      if (createData.groupUuid && createData.autoNavigate !== false) {
        setTimeout(() => {
          const newGroup = this.backBufferGroupItems.find(g => g.groupUuid === createData.groupUuid);
          if (newGroup) {
            this.goToGroupChat({
              chatType: 'group',
              groupUuid: newGroup.groupUuid,
              groupName: newGroup.groupName,
              memberCount: newGroup.memberCount || 0
            });
          }
        }, 1000);
      }
    } catch (error) {
      console.error('刷新群聊列表失败:', error);
      wx.showToast({
        title: '刷新群聊失败',
        icon: 'none',
        duration: 1500
      });
    } finally {
      this.hideLoading();
    }
  },

  async onRecallMessageGroup(msg) {
    console.log('收到群聊撤回消息:', msg);
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析群聊撤回消息失败:', e);
        return;
      }
    }

    if (messageData.type === 'recall_message_group') {
      const recalledMessageId = messageData.id;
      const groupUuid = messageData.groupUuid;
      const recallerOpenid = messageData.from;
      const recallerNickname = messageData.senderNickname;

      let finalNickname = recallerNickname;

      if (!finalNickname || finalNickname === '') {
        try {
          finalNickname = await this.getOneConsumer(recallerOpenid);
        } catch (err) {
          console.error('获取撤回者昵称失败:', err);
          finalNickname = '对方';
        }
      }

      if (!finalNickname) {
        finalNickname = '对方';
      }

      this.updateGroupMessageAfterRecallImmediate(groupUuid, recalledMessageId, recallerOpenid, finalNickname);
    }
  },

  getOneConsumer(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_ONE_CONSUMER,
        method: 'POST',
        header: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        data: { openid: openid },
        success: (res) => {
          if (res.data && res.data.data) {
            resolve(res.data.data.nickname);
          } else {
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  },

  updateGroupMessageAfterRecallImmediate(groupUuid, recalledMessageId, recallerOpenid, recallerNickname) {
    const currentOpenid = this.data.openid;
    let hasUpdate = false;

    let recallContent;
    if (recallerOpenid === currentOpenid) {
      recallContent = '你撤回了一条消息';
    } else {
      recallContent = `${recallerNickname}撤回了一条消息`;
    }

    for (let i = 0; i < this.groupChatItems.length; i++) {
      const item = this.groupChatItems[i];
      if (item.groupUuid === groupUuid && item.last_message) {
        if (String(item.last_message.id) === String(recalledMessageId)) {
          this.groupChatItems[i].last_message = {
            ...this.groupChatItems[i].last_message,
            content: recallContent,
            isRecalled: true
          };
          hasUpdate = true;
          break;
        }
      }
    }

    const chat_list = [...this.data.chat_list];
    for (let i = 0; i < chat_list.length; i++) {
      const item = chat_list[i];
      if (item.chatType === 'group' && item.groupUuid === groupUuid && item.last_message) {
        if (String(item.last_message.id) === String(recalledMessageId)) {
          chat_list[i] = {
            ...chat_list[i],
            last_message: {
              ...chat_list[i].last_message,
              content: recallContent,
              isRecalled: true
            }
          };
          hasUpdate = true;
          break;
        }
      }
    }

    if (hasUpdate) {
      this.setData({ chat_list });
      if (this.mergeTimer) {
        clearTimeout(this.mergeTimer);
        this.mergeTimer = null;
      }
      this.mergeAllChats();
    } else {
      this.loadGroupChats();
    }
  },

  formatMessageContent(messageData) {
    switch (messageData.messageType) {
      case 1: return messageData.content || '[文本消息]';
      case 2: return '[图片]';
      case 3: return '[语音]';
      case 4: return '[视频]';
      default: return messageData.content || '[新消息]';
    }
  },

  formatMessageTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return '';
    }
  },

  formatShortTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
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
    } catch (error) {
      return '';
    }
  },

  updateOrCreateChatItem(openid, unreadCount, messageData) {
    if (!this.data.chat_list || this.data.chat_list.length === 0) {
      this.refreshChatList().then(() => {
        this.updateOrCreateChatItem(openid, unreadCount, messageData);
      });
      return;
    }

    const chat_list = [...this.data.chat_list];
    let found = false;
    let displayContent = this.formatMessageContent(messageData);

    const currentOpenid = this.getUserInfo().openId;
    const isSelfMessage = messageData.from === currentOpenid;

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].openid === openid && chat_list[i].chatType !== 'group') {
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
            isRead: isSelfMessage ? true : false,
            senderOpenid: messageData.from,
            isRecalled: false
          }
        };
        found = true;
        break;
      }
    }

    if (!found) {
      const newChatItem = {
        chatType: 'private',
        openid: openid,
        nickname: '加载中...',
        avatarUrl: '../../resources/404.png',
        message: unreadCount,
        last_message: {
          id: messageData.id,
          content: displayContent,
          sendTime: messageData.time,
          sendTimeFormat: this.formatMessageTime(messageData.time),
          sendTimeShort: this.formatShortTime(messageData.time),
          messageType: messageData.messageType,
          isRead: isSelfMessage ? true : false,
          senderOpenid: messageData.from,
          isRecalled: false
        }
      };
      chat_list.push(newChatItem);

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

    const updatedList = this.sortChatList(chat_list);
    this.setData({ chat_list: updatedList });
  },

  updateOrCreateGroupChatItem(groupUuid, unreadCount, messageData) {
    const sendTime = messageData.time || messageData.sendTime || messageData.createTime || new Date().toISOString();
    const sendTimeFormat = this.formatMessageTime(sendTime);
    const sendTimeShort = this.formatShortTime(sendTime);

    let displayContent = this.formatMessageContent(messageData);

    if (messageData.isRecalled) {
      const currentOpenid = this.data.openid;
      const isSelfRecall = messageData.from === currentOpenid;
      if (isSelfRecall) {
        displayContent = '你撤回了一条消息';
      } else {
        const recallerName = messageData.senderNickname || messageData.fromNickname || '对方';
        displayContent = `${recallerName}撤回了一条消息`;
      }
    } else if (messageData.fromNickname) {
      displayContent = `${messageData.fromNickname}: ${displayContent}`;
    }

    const newLastMessage = {
      id: messageData.id,
      content: displayContent,
      sendTime: sendTime,
      sendTimeFormat: sendTimeFormat,
      sendTimeShort: sendTimeShort,
      messageType: messageData.messageType,
      isRead: false,
      senderOpenid: messageData.from,
      senderNickname: messageData.fromNickname,
      isRecalled: messageData.isRecalled || false
    };

    const groupChatIndex = this.groupChatItems.findIndex(item => item.groupUuid === groupUuid);
    if (groupChatIndex !== -1) {
      this.groupChatItems[groupChatIndex] = {
        ...this.groupChatItems[groupChatIndex],
        message: unreadCount,
        last_message: newLastMessage
      };
    } else {
      const newChatItem = {
        chatType: 'group',
        groupUuid: groupUuid,
        groupName: messageData.groupName || '群聊',
        nickname: messageData.groupName || '群聊',
        avatarUrl: '',
        memberAvatars: [],
        message: unreadCount,
        memberCount: 0,
        last_message: newLastMessage
      };
      this.groupChatItems.push(newChatItem);
    }

    const chat_list = [...this.data.chat_list];
    let found = false;

    for (let i = 0; i < chat_list.length; i++) {
      if (chat_list[i].chatType === 'group' && chat_list[i].groupUuid === groupUuid) {
        chat_list[i] = {
          ...chat_list[i],
          message: unreadCount,
          last_message: newLastMessage
        };
        found = true;
        break;
      }
    }

    if (!found) {
      const newChatItem = {
        chatType: 'group',
        groupUuid: groupUuid,
        groupName: messageData.groupName || '群聊',
        nickname: messageData.groupName || '群聊',
        avatarUrl: '../../resources/404.png',
        memberAvatars: [],
        message: unreadCount,
        memberCount: 0,
        last_message: newLastMessage
      };
      chat_list.push(newChatItem);
    }

    const updatedList = this.sortChatList(chat_list);
    this.setData({ chat_list: updatedList });
  },

  getUserInfoByOpenid(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_LIST_CONSUMER,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: [openid],
        success: (res) => {
          if (res.data && res.data.data && res.data.data.length > 0) {
            resolve(res.data.data[0]);
          } else {
            reject('未找到用户信息');
          }
        },
        fail: (err) => reject(err)
      });
    });
  },

  getMyGroups(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_OPENID_GROUP,
        method: 'POST',
        header: { 'content-type': 'application/x-www-form-urlencoded' },
        data: { openid: openid },
        success: (res) => {
          const groupList = Array.isArray(res.data) ? res.data : [];
          resolve(groupList);
        },
        fail: (err) => reject(err)
      });
    });
  },

  async loadGroupChats() {
    try {
      const groupList = await this.getMyGroups(this.data.openid);
      this.setData({ group_list: groupList });

      if (groupList.length === 0) {
        this.groupChatItems = [];
        this.debouncedMerge();
        return;
      }

      const groupChatItems = groupList.map(group => this.transformGroupToChatItem(group));
      this.groupChatItems = groupChatItems;

      await Promise.all([
        this.getGroupLastMessages(groupList),
        ...groupList.map(group => {
          const openidList = group.groupMembers?.map(m => m.openid) || [];
          if (openidList.length > 0) {
            return this.getGroupMemberAvatars(group.groupUuid, openidList);
          }
          return Promise.resolve();
        })
      ]);

      this.debouncedMerge();
    } catch (err) {
      console.error('加载群聊失败:', err);
      this.groupChatItems = [];
      this.debouncedMerge();
    }
  },

  transformGroupToChatItem(group) {
    const key = `group_${group.groupUuid}`;
    const unreadCount = this.getUnreadCount(key);

    const memberAvatars = (group.memberAvatars || [])
      .map(item => item.avatarUrl || item)
      .filter(url => url && url.length > 0);

    return {
      chatType: 'group',
      groupUuid: group.groupUuid,
      groupName: group.groupName,
      groupMembers: group.groupMembers,
      openid: null,
      nickname: group.groupName,
      memberAvatars: memberAvatars,
      avatarUrl: '../../resources/404.png',
      message: unreadCount,
      memberCount: group.groupMembers ? group.groupMembers.length : 0,
      last_message: null
    };
  },

  getGroupMemberAvatars(groupUuid, openidList) {
    return new Promise((resolve) => {
      wx.request({
        url: GET_CONSUMER_URL,
        method: 'POST',
        data: openidList,
        success: (res) => {
          const memberAvatars = res.data.data || [];
          const avatarUrls = memberAvatars
            .map(item => item.avatarUrl || item)
            .filter(url => url && url.length > 0);

          const groupList = this.data.group_list;
          const groupIndex = groupList.findIndex(g => g.groupUuid === groupUuid);
          if (groupIndex !== -1) {
            groupList[groupIndex].memberAvatars = memberAvatars;
            this.setData({ group_list: groupList });
          }

          const chatIndex = this.groupChatItems.findIndex(item => item.groupUuid === groupUuid);
          if (chatIndex !== -1) {
            const oldAvatars = this.groupChatItems[chatIndex].memberAvatars || [];
            if (JSON.stringify(oldAvatars) !== JSON.stringify(avatarUrls)) {
              this.groupChatItems[chatIndex].memberAvatars = avatarUrls;
              this.debouncedMerge();
            }
          }
          resolve();
        },
        fail: (err) => {
          console.error('获取群成员头像失败:', err);
          resolve();
        }
      });
    });
  },

  debouncedMerge() {
    if (this.mergeTimer) {
      clearTimeout(this.mergeTimer);
    }
    this.mergeTimer = setTimeout(() => {
      this.mergeAllChats();
      this.mergeTimer = null;
    }, 200);
  },

  mergeAllChats() {
    if (this.isMerging) {
      this.needMerge = true;
      return;
    }

    this.isMerging = true;
    this.needMerge = false;

    try {
      const privateChats = this.data.chat_list || [];
      const groupChats = this.groupChatItems || [];

      let allChats = [...privateChats, ...groupChats];

      allChats.sort((a, b) => {
        if (!a.last_message && !b.last_message) return 0;
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
      });

      const uniqueMap = new Map();
      for (const chat of allChats) {
        let key;
        if (chat.chatType === 'group') {
          key = `group_${chat.groupUuid}`;
        } else {
          key = `private_${chat.openid}`;
        }
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, chat);
        }
      }
      const newChatList = Array.from(uniqueMap.values());

      const oldChatListStr = JSON.stringify(this.data.chat_list);
      const newChatListStr = JSON.stringify(newChatList);

      if (oldChatListStr !== newChatListStr) {
        this.setData({ chat_list: newChatList });
      }
    } catch (err) {
      console.error('合并聊天列表失败:', err);
    } finally {
      this.isMerging = false;

      if (this.needMerge) {
        this.mergeAllChats();
      }
    }
  },

  sortChatList(chat_list) {
    if (!chat_list || chat_list.length === 0) return chat_list;
    return [...chat_list].sort((a, b) => {
      if (!a.last_message && !b.last_message) return 0;
      if (!a.last_message) return 1;
      if (!b.last_message) return -1;
      return new Date(b.last_message.sendTime) - new Date(a.last_message.sendTime);
    });
  },

  async refreshChatList() {
    if (!this.data.openid || this.isLoading) return;

    this.isLoading = true;
    await this.loadPrivateChats();
    await this.loadGroupChats();
    this.isLoading = false;
  },

  async initChatPage() {
    if (!this.checkLogin()) {
      console.log('未登录，不初始化聊天页面');
      this.setData({
        chat_list: [],
        group_list: [],
        openid: null,
        isPageReady: true
      });
      return;
    }
    
    await this.refreshAllData();
    this.setData({ isPageReady: true });
  },

  getOpenid() {
    return new Promise((resolve) => {
      if (!this.checkLogin()) {
        this.showLoginTip();
        resolve(null);
        return;
      }

      const userInfo = this.getUserInfo();
      const openid = userInfo.openId;
      this.setData({ openid: openid });
      resolve(openid);
    });
  },

  async loadPrivateChats() {
    return new Promise(async (resolve) => {
      if (!this.data.openid) {
        resolve();
        return;
      }

      try {
        const openid_list = await this.requestWhoChat();
        this.setData({ openid_list: openid_list });

        if (!openid_list || openid_list.length === 0) {
          this.setData({ chat_list: [] });
          resolve();
          return;
        }

        const [chatListInfo, lastChatInfo] = await Promise.all([
          this.requestChatListInfo(openid_list),
          this.requestLastChat(openid_list)
        ]);

        const mergedList = this.mergeChatDataWithInfo(chatListInfo, lastChatInfo);
        this.setData({ chat_list: mergedList });
        resolve();
      } catch (error) {
        console.error('加载私聊失败:', error);
        resolve();
      }
    });
  },

  requestWhoChat() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_WHO_CHAT,
        method: 'POST',
        header: { 'content-type': 'application/x-www-form-urlencoded' },
        data: { openid: this.data.openid },
        success: (res) => {
          const openid_list = Array.isArray(res.data) ? res.data : [];
          resolve(openid_list);
        },
        fail: (err) => reject(err)
      });
    });
  },

  requestChatListInfo(openid_list) {
    return new Promise((resolve, reject) => {
      if (!openid_list || openid_list.length === 0) {
        resolve([]);
        return;
      }

      wx.request({
        url: GET_LIST_CONSUMER,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: openid_list,
        success: (res) => {
          let chatList = Array.isArray(res.data.data) ? res.data.data : [];
          chatList = chatList.map(item => ({
            ...item,
            chatType: 'private'
          }));
          resolve(chatList);
        },
        fail: (err) => reject(err)
      });
    });
  },

  requestLastChat(openid_list) {
    return new Promise((resolve, reject) => {
      if (!openid_list || openid_list.length === 0) {
        resolve([]);
        return;
      }

      wx.request({
        url: GET_LAST_CHAT + '/' + this.getUserInfo().openId,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: openid_list,
        success: (res) => {
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
          resolve(lastChatArray);
        },
        fail: (err) => reject(err)
      });
    });
  },

  mergeChatDataWithInfo(chatListInfo, lastChatInfo) {
    if (!chatListInfo || !Array.isArray(chatListInfo)) return [];
    if (!lastChatInfo || !Array.isArray(lastChatInfo)) return chatListInfo;

    const lastChatMap = new Map();
    lastChatInfo.forEach(chat => {
      if (chat && chat.openid) {
        lastChatMap.set(chat.openid, chat);
      }
    });

    const mergedList = chatListInfo.map(user => {
      const lastChat = lastChatMap.get(user.openid);
      const unreadCount = this.getUnreadCount(user.openid);

      if (lastChat) {
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
          chatType: 'private',
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
        chatType: 'private',
        message: unreadCount,
        last_message: null
      };
    });

    return this.sortChatList(mergedList);
  },

  onChatTap(e) {
    const chatItem = e.currentTarget.dataset.user;

    if (chatItem.chatType === 'group') {
      this.goToGroupChat(chatItem);
    } else {
      this.goToPrivateChat(chatItem);
    }
  },

  goToGroupChat(chatItem) {
    const key = `group_${chatItem.groupUuid}`;
    const currentUnread = this.getUnreadCount(key);

    wx.navigateTo({
      url: `/pages/chat-group/chat-group?groupUuid=${chatItem.groupUuid}&groupName=${encodeURIComponent(chatItem.groupName)}&memberCount=${chatItem.memberCount || 0}`,
      success: () => {
        if (currentUnread > 0) {
          this.clearUnreadCount(key);
          const app = getApp();
          app.clearUnreadCount(key);

          setTimeout(() => {
            app.updateTabBarBadges();
          }, 500);
          this.syncUnreadCountFromGlobal();
        }
      }
    });
  },

  goToPrivateChat(chatItem) {
    const currentUnread = this.getUnreadCount(chatItem.openid);

    if (currentUnread > 0) {
      this.clearUnreadCount(chatItem.openid);
      const app = getApp();
      app.clearUnreadCount(chatItem.openid);
      setTimeout(() => {
        app.updateTabBarBadges();
      }, 200);
      this.syncUnreadCountFromGlobal();
    }

    wx.navigateTo({
      url: '/pages/chat-ui/chat-ui',
      success: (res) => {
        res.eventChannel.emit('sendData', {
          one_consumer: chatItem
        });
      }
    });
  },

  onOfflineMessagesLoaded(offlineData) {
    console.log('收到离线消息数据，刷新列表', offlineData);
    this.syncUnreadCountFromGlobal();
  }
});