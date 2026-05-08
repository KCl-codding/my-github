const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_ONE_GROUP = API_CONFIG.MESSAGE_URL + API_CONFIG.GROUP.get_one_group;
const GET_CONSUMER_URL = API_CONFIG.BASE_URL + API_CONFIG.USER.get_consumer_url;
const GET_ONE_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_one_consumer;

Page({
  behaviors: [loginTipBehavior],

  /*———————————————— 页面数据绑定 ————————————————*/
  data: {
    self_url: null,
    self_nickname: null,        // 自己的昵称

    groupInfo: {},              // 群聊信息
    groupUuid: null,            // 群聊UUID
    groupName: '',              // 群名称
    groupMembers: [],           // 群成员列表
    memberCount: 0,             // 成员数量

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

    // 群成员头像映射（用于显示发送者头像）
    memberAvatarMap: {},
    memberNicknameMap: {},

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
  _TIME_INTERVAL: 5 * 60 * 1000, // 时间间隔阈值：5分钟

  /*———————————————— 生命周期：页面加载 ————————————————*/
  onLoad(options) {
    const { groupUuid, groupName, memberCount } = options;

    if (!groupUuid) {
      wx.showToast({ title: '群聊信息错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.onNewMessageGroup = this.onNewMessageGroup.bind(this);
    this.onRecallMessageGroup = this.onRecallMessageGroup.bind(this);


    // 监听全局新消息事件
    const app = getApp();
    app.onEvent('newMessageGroup', this.onNewMessageGroup);
    app.onEvent('recallMessageGroup', this.onRecallMessageGroup);

    const userInfo = this.getUserInfo();
    this.setData({
      self_url: userInfo.avatarUrl,
      self_nickname: userInfo.nickName || '我',
      groupUuid: groupUuid,
      groupName: decodeURIComponent(groupName || '群聊'),
      memberCount: parseInt(memberCount) || 0
    });

    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: decodeURIComponent(groupName || '群聊')
    });

    // 启动连接状态检测
    this.startConnectionMonitor();

    // 获取窗口高度并计算滚动区域
    const systemInfo = wx.getSystemInfoSync();
    this.setData({ windowHeight: systemInfo.windowHeight });
    this.calculateScrollViewHeight();

    // 加载群信息和成员列表
    this.getOneGroup(groupUuid);

    // 加载历史消息
    this.showLoading();
    this.hideLoading();
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
    // 清除定时器
    if (this._connectionInterval) {
      clearInterval(this._connectionInterval);
    }

    const app = getApp();
    app.offEvent('newMessageGroup', this.onNewMessageGroup);
    app.offEvent('recallMessageGroup', this.onRecallMessageGroup);
    
    // 离开群聊页面时，清除该群聊的未读数
    const currentGroupUuid = this.data.groupUuid;
    if (currentGroupUuid) {
      const app = getApp();
      app.clearUnreadCount(`group_${currentGroupUuid}`);
      app.updateTabBarBadges();
    }
  },

  /*———————————————— 群信息加载 ————————————————*/
  
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
            resolve(null); // 没找到时返回 null
          }
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
          reject(err);
        }
      });
    });
  },

  async getOneGroup(groupUuid) {
    wx.request({
      url: GET_ONE_GROUP,
      method: 'POST',
      data: { groupUuid: groupUuid },
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      success: async (res) => {
        console.log(res.data);
        const messages = res.data;
        const userInfo = this.getUserInfo();
        const currentOpenid = userInfo.openId;
  
        // 收集所有需要获取昵称的撤回消息发送者
        const recallOpenids = [];
        messages.forEach(msg => {
          if (msg.isRecalled === true && msg.senderOpenid !== currentOpenid) {
            if (!recallOpenids.includes(msg.senderOpenid)) {
              recallOpenids.push(msg.senderOpenid);
            }
          }
        });
  
        // 批量获取昵称
        const nickNameMap = {};
        for (const openid of recallOpenids) {
          try {
            const nickName = await this.getOneConsumer(openid);
            if (nickName) {
              nickNameMap[openid] = nickName;
            }
          } catch (err) {
            console.error(`获取昵称失败 ${openid}:`, err);
          }
        }
  
        // 处理消息列表
        const messageList = messages.map(msg => {
          if (msg.isRecalled === true) {
            const isSelf = msg.senderOpenid === currentOpenid;
            let recallContent;
            
            if (isSelf) {
              recallContent = '你撤回了一条消息';
            } else {
              const nickName = nickNameMap[msg.senderOpenid] || '某人';
              recallContent = `${nickName}撤回了一条消息`;
            }
            
            return {
              id: msg.id,
              content: recallContent,
              isSystem: true,
              isRecallTip: true,
              recallFor: msg.id,
              sendTime: msg.sendTime,
              timestamp: new Date(msg.sendTime).getTime(),
              createTime: this.formatTime(new Date(msg.sendTime)),
              _shouldPersist: true,
              originalSenderOpenid: msg.senderOpenid,
              originalSenderNickname: msg.senderNickname
            };
          }
          
          return {
            ...msg,
            isSelf: msg.senderOpenid === currentOpenid,
            timestamp: new Date(msg.sendTime).getTime(),
            createTime: this.formatTime(new Date(msg.sendTime)),
            avatarUrl: msg.senderOpenid === currentOpenid ? this.data.self_url : '',
            showName: msg.senderOpenid !== currentOpenid,
            isRecalled: false
          };
        });
  
        this.setData({
          messageList: messageList,
          groupUuid: groupUuid
        });
  
        // 获取其他用户的头像
        const openidList = [];
        messages.forEach(msg => {
          if (msg.senderOpenid && msg.senderOpenid !== currentOpenid && !msg.isRecalled) {
            if (!openidList.includes(msg.senderOpenid)) {
              openidList.push(msg.senderOpenid);
            }
          }
        });
  
        if (openidList.length > 0) {
          this.getGroupMemberAvatars(openidList);
        } else {
          const processedList = this.addTimeTipsToMessages(this.data.messageList);
          this.setData({ messageList: processedList });
          this.hideLoading();
          setTimeout(() => {
            this.scrollToBottom();
          }, 300);
        }
      },
      fail: (err) => {
        console.error('获取历史消息失败:', err);
        this.hideLoading();
      }
    });
  },
  // 批量获取用户头像 - 循环调用单个接口
  async getGroupMemberAvatars(openidList) {
    const avatarMap = {};

    if (openidList.length === 0) {
      const processedList = this.addTimeTipsToMessages(this.data.messageList);
      this.setData({ messageList: processedList });
      this.hideLoading();
      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
      return;
    }

    // 循环调用接口获取每个用户的头像
    for (let i = 0; i < openidList.length; i++) {
      const openid = openidList[i];
      try {
        const res = await this.getConsumerUrl(openid);
        if (res && res.code === 200 && res.data) {
          avatarMap[openid] = res.data;
        }
      } catch (err) {
        console.error('获取头像失败 openid:', openid, err);
      }
    }

    // 更新消息列表中的头像
    const updatedMessageList = this.data.messageList.map(msg => {
      if (!msg.isSelf && avatarMap[msg.senderOpenid]) {
        return {
          ...msg,
          avatarUrl: avatarMap[msg.senderOpenid]
        };
      }
      return msg;
    });

    this.setData({
      messageList: updatedMessageList,
      memberAvatarMap: avatarMap
    });

    const processedList = this.addTimeTipsToMessages(this.data.messageList);
    this.setData({ messageList: processedList });

    this.hideLoading();
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },
  // 单个获取用户头像的接口
  getConsumerUrl(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_CONSUMER_URL,
        method: 'POST',
        data: {
          openid: openid
        },
        header: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },
  /*———————————————— 连接状态管理 ————————————————*/
  startConnectionMonitor() {
    const app = getApp();
    const checkConnection = () => {
      this._isConnected = app.getSocketStatus();
      if (this._isConnected && this._pendingMessages.length > 0) {
        const pendingCopy = [...this._pendingMessages];
        this._pendingMessages = [];
        pendingCopy.forEach(msg => {
          if (msg.type === 'send') {
            this.sendGroupMessage(msg.content);
          } else {
            this.processMessage(msg);
          }
        });
      }
    };
    checkConnection();
    this._connectionInterval = setInterval(checkConnection, 3000);
  },

  /*———————————————— 消息接收处理 ————————————————*/
  onNewMessageGroup(msg) {
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析消息失败:', e);
        return;
      }
    }
  
    if (messageData.type === 'new_message_group') {
      // 判断是否是当前群聊的消息
      if (this.data.groupUuid !== messageData.groupUuid) {
        return;
      }
      
      // 调用 processMessage 处理消息
      this.processMessage(messageData);
    }
  },
  onRecallMessageGroup(msg) {
    console.log('onRecallMessageGroup 被调用了', msg);
    let messageData = msg;
    if (typeof msg === 'string') {
      try {
        messageData = JSON.parse(msg);
      } catch (e) {
        console.error('解析消息失败:', e);
        return;
      }
    }
  
    console.log('收到群聊撤回消息:', messageData);
  
    // 撤回消息类型
    if (messageData.type === 'recall_message_group') {
      const recalledMessageId = messageData.id;  // 这是被撤回的那条消息的ID
      const groupUuid = messageData.groupUuid;
      const from = messageData.from;  // 谁执行的撤回操作
      
      // 检查是否是当前群聊
      if (groupUuid !== this.data.groupUuid) {
        return;
      }
      
      const openid = this.getUserInfo().openId;
      const isSelfRecall = (from === openid);  // 是否自己撤回的
      
      // 查找被撤回的消息（用 recalledMessageId 去匹配）
      const messageList = this.data.messageList;
      const recallIndex = messageList.findIndex(item => item.id === recalledMessageId && !item.isSystem);
      
      if (recallIndex !== -1) {
        const newMessageList = [...messageList];
        const recalledMsg = newMessageList[recallIndex];

        // 确定撤回提示文字
        let recallContent = '';
        if (isSelfRecall) {
          recallContent = '你撤回了一条消息';
        }else {
          recallContent = `${msg.senderNickname}撤回了一条消息`;
        }
        
        // 把原消息替换成撤回系统消息
        newMessageList[recallIndex] = {
          id: recalledMsg.id,
          content: recallContent,
          isSystem: true,
          isRecallTip: true,
          recallFor: recalledMessageId,
          createTime: recalledMsg.createTime,
          timestamp: Date.now(),
          sendTime: new Date().toISOString(),
          _shouldPersist: true
        };
        
        const processedList = this.addTimeTipsToMessages(newMessageList);
        this.setData({ messageList: processedList });
        
        console.log('群聊撤回成功，已替换消息:', recalledMessageId);
      } else {
        console.log('未找到要撤回的消息:', recalledMessageId);
      }
    }
  },
  
  processMessage(msg) {
    const openid = this.getUserInfo().openId;
    const isSelf = (msg.from === openid);
    
    // 如果是自己发送的消息，查找并替换临时消息
    if (isSelf) {
      // 查找是否有相同内容的临时消息（最近5秒内的）
      const tempIndex = this.data.messageList.findIndex(item => {
        return item.isTemp && item.content === msg.content && (Date.now() - item.timestamp < 5000);
      });
      
      if (tempIndex !== -1) {
        // 替换临时消息为真实消息
        const updatedList = [...this.data.messageList];
        updatedList[tempIndex] = {
          ...updatedList[tempIndex],
          id: msg.id || Date.now(),
          status: 'success',
          isTemp: false,
          sendTime: msg.sendTime,
          timestamp: new Date(msg.sendTime).getTime(),
          createTime: this.formatTime(new Date(msg.sendTime))
        };
        
        const processedList = this.addTimeTipsToMessages(updatedList);
        this.setData({ messageList: processedList });
        return;
      }
    }
    
    // 非自己发送的消息，正常添加
    const msgKey = `${msg.from}_${msg.content}_${msg.sendTime}`;
    if (this._lastMsgKey === msgKey) return;
    this._lastMsgKey = msgKey;
    
    const senderNickname = msg.senderNickname;
  
    let tempMessage;
  
    if (msg.isRecalled === true || msg.isRecalled === 1) {
      tempMessage = {
        id: msg.id || Date.now(),
        content: isSelf ? '你撤回了一条消息' : `${senderNickname}撤回了一条消息`,
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
        messageType: msg.messageType || 1,
        senderOpenid: msg.from,
        senderNickname: isSelf ? this.data.self_nickname : senderNickname,
        createTime: this.formatTime(new Date(msg.sendTime)),
        isSelf: isSelf,
        status: 'success',
        timestamp: new Date(msg.sendTime).getTime(),
        sendTime: msg.sendTime,
        isRecalled: false,
        avatarUrl: isSelf ? this.data.self_url : (this.data.memberAvatarMap[msg.from] || '/resources/404.png'),
        showName: !isSelf
      };
    }
  
    let newList = [...this.data.messageList, tempMessage];
    newList = this.addTimeTipsToMessages(newList);
  
    this.setData({ messageList: newList });
  
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  },
  /*———————————————— 时间标签处理函数 ————————————————*/
  addTimeTipsToMessages(messages) {
    if (!messages || messages.length === 0) return messages;

    const result = [];
    let lastTimestamp = null;

    for (let i = 0; i < messages.length; i++) {
      const currentMsg = messages[i];
      const currentTimestamp = currentMsg.timestamp || currentMsg.sendTime || currentMsg.id;

      let shouldShowTimeTip = false;
      let timeTipText = '';

      if (i === 0) {
        shouldShowTimeTip = true;
        timeTipText = this.formatTimeTip(currentTimestamp);
      } else if (lastTimestamp) {
        const timeDiff = Math.abs(currentTimestamp - lastTimestamp);
        if (timeDiff >= this._TIME_INTERVAL) {
          shouldShowTimeTip = true;
          timeTipText = this.formatTimeTip(currentTimestamp);
        }
      }

      const newMsg = { ...currentMsg };

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

  formatTimeTip(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 24 * 3600 * 1000);

    if (date >= today) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else if (date >= yesterday && date < today) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `昨天 ${hours}:${minutes}`;
    } else if (date.getFullYear() === now.getFullYear()) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}月${day}日 ${hours}:${minutes}`;
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    }
  },

  /*———————————————— 消息发送处理 ————————————————*/
  onConfirmSend(e) {
    let realValue = '';

    if (e.detail && e.detail.value !== undefined) {
      realValue = e.detail.value;
    } else {
      realValue = this.data.inputValue;
    }

    if (realValue !== this.data.inputValue) {
      this.setData({ inputValue: realValue });
    }

    const content = realValue.trim();
    if (content) {
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
  doSendMessage(content) {
    const groupUuid = this.data.groupUuid;
    const userInfo = this.getUserInfo();
    
    // 生成临时ID
    const tempId = `temp_${Date.now()}`;
  
    // 乐观更新
    const newMessage = {
      id: tempId,  // 临时ID
      content: content,
      type: 'text',
      messageType: 1,
      senderOpenid: userInfo.openId,
      senderNickname: userInfo.nickName || '我',
      groupUuid: groupUuid,
      createTime: this.formatTime(new Date()),
      isSelf: true,
      status: 'sending',
      timestamp: Date.now(),
      isRecalled: false,
      avatarUrl: this.data.self_url,
      showName: false,
      isTemp: true  // 标记为临时消息
    };
  
    let newList = [...this.data.messageList, newMessage];
    newList = this.addTimeTipsToMessages(newList);
  
    this.setData({
      messageList: newList,
      inputValue: ''
    });
  
    // 发送群消息
    this.sendGroupMessage(content);
  
    if (this.data.isKeyboardShow) {
      setTimeout(() => this.scrollLastMessageToVisible(), 100);
    } else {
      this.scrollToBottom();
    }
  },
  sendGroupMessage(content) {
    const app = getApp();

    if (!this._isConnected) {
      wx.showToast({ title: '网络连接中，请稍后', icon: 'none', duration: 2000 });
      setTimeout(() => {
        if (this._isConnected) {
          app.sendGroupMessage({ groupUuid: this.data.groupUuid, content });
        } else {
          wx.showToast({ title: '网络异常，发送失败', icon: 'none' });
        }
      }, 3000);
      return;
    }

    app.sendMessage({
      type: 'new_group_message',
      groupUuid: this.data.groupUuid,
      content: content
    });
  },
  /*———————————————— 长按菜单 ————————————————*/
  onLongPressMessage(e) {
    const message = e.currentTarget.dataset.message;
    if (!message) return;

    if (message.isSystem) {
      console.log('系统消息不能长按操作');
      return;
    }

    this.setData({ currentMessage: message });

    let showRecall = false;
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
  
    const sendTime = message.sendTime ? new Date(message.sendTime).getTime() : message.timestamp;
    const timeDiff = (Date.now() - sendTime) / 1000;
    if (timeDiff > 120) {
      wx.showToast({ title: '消息已超过2分钟，无法撤回', icon: 'none' });
      this.hideMenu();
      return;
    }
  
    const openid = this.getUserInfo().openId;
  
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
      newMessageList[recallIndex] = {
        id: newMessageList[recallIndex].id,
        content: '你撤回了一条消息',
        isSystem: true,
        isRecallTip: true,
        recallFor: message.id,
        createTime: newMessageList[recallIndex].createTime,
        timestamp: newMessageList[recallIndex].timestamp,
        sendTime: newMessageList[recallIndex].sendTime,
        _shouldPersist: true
      };
  
      const processedList = this.addTimeTipsToMessages(newMessageList);
      this.setData({ messageList: processedList });
      console.log('本地撤回成功，已替换消息:', message.id);
    }
  
    this.hideMenu();
  
    const app = getApp();
    if (this._isConnected) {
      // 群聊撤回需要发送 groupUuid 和 messageId
      app.sendMessage({
        type: 'recall_group_message',  // 群聊撤回类型
        senderNickname :this.getUserInfo().nickName,
        groupUuid: this.data.groupUuid,  // 群聊UUID
        messageId: message.id,           // 消息ID
        sendTime: message.sendTime || new Date(sendTime).toISOString()
      });
    } else {
      wx.showToast({ title: '网络异常，撤回失败', icon: 'none' });
    }
  },
  onMenuDelete() {
    const message = this.data.currentMessage;
    if (!message) return;

    const newMessageList = this.data.messageList.filter(msg => msg.id !== message.id);
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

  // 查看群成员
  onViewMembers() {
    wx.navigateTo({
      url: `/pages/group-members/group-members?groupUuid=${this.data.groupUuid}&groupName=${encodeURIComponent(this.data.groupName)}`
    });
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