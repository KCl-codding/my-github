const API_CONFIG = require('../../config/api-config.js');
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const GET_ALL_ACTIVITY = API_CONFIG.MESSAGE_URL + API_CONFIG.ACTIVITY.get_all_activity
const GET_ONE_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_one_consumer
const GET_UUID_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.get_uuid_yard
const GET_JOIN_COUNT = API_CONFIG.MESSAGE_URL + API_CONFIG.ACTIVITY.get_join

Page({
  behaviors: [loginTipBehavior],

  data: {
    one_consumer: {},
    one_yard: {},

    activityList: [],      // 所有活动统一列表
    currentUserOpenId: '',  // 当前用户的openId
    scrollIntoView: ''      // 新增：用于滚动
  },

  async onLoad() {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，清空活动数据');
      this.setData({
        activityList: [],
        currentUserOpenId: ''
      });
      return;
    }
    
    const userInfo = this.getUserInfo();
    this.setData({
      currentUserOpenId: userInfo.openId
    });
    this.getAllActivity();
    
    // 监听新消息事件
    const app = getApp();

    this.handleNewActivity = this.handleNewActivity.bind(this);
    this.handleActivityCancelled = this.handleActivityCancelled.bind(this);
    this.handleJoinActivity = this.handleJoinActivity.bind(this);
    this.handleExitActivity = this.handleExitActivity.bind(this);
    this.onCreateGroupSuccess = this.onCreateGroupSuccess.bind(this)

    app.onEvent('newActivity', this.handleNewActivity);
    app.onEvent('activityCancelled', this.handleActivityCancelled);
    app.onEvent('activityJoined', this.handleJoinActivity);
    app.onEvent('activityExit', this.handleExitActivity);
    app.onEvent('createGroupSuccess',this.onCreateGroupSuccess);
  },

  onShow() {
    console.log('活动页面 onShow');
    
    // 检查登录状态
    if (!this.checkLogin()) {
        console.log('未登录，清空活动数据');
        this.setData({
            activityList: [],
            currentUserOpenId: ''
        });
        return;
    }
    
    // 已登录状态
    console.log('已登录，检查是否需要刷新数据');
    
    // 获取当前用户信息
    const userInfo = this.getUserInfo();
    const currentOpenId = userInfo?.openId;
    
    // 如果之前没有 currentUserOpenId 或者发生了变化，需要重新加载
    if (!this.data.currentUserOpenId || this.data.currentUserOpenId !== currentOpenId) {
        console.log('用户信息变化，重新加载活动数据');
        this.setData({
            currentUserOpenId: currentOpenId
        });
        this.getAllActivity();
    } else if (this.data.activityList.length === 0) {
        // 如果活动列表为空，也重新加载
        console.log('活动列表为空，重新加载');
        this.getAllActivity();
    }
    
    // 每次进入活动页面时，清除活动未读数
    const app = getApp();
    app.clearActivityUnreadCount();
},

  onUnload() {
    // 页面卸载时移除监听
    const app = getApp();
    app.offEvent('newActivity', this.handleNewActivity);
    app.offEvent('activityCancelled', this.handleActivityCancelled);
    app.offEvent('activityJoined', this.handleJoinActivity);
    app.offEvent('activityExit', this.handleExitActivity);
    app.offEvent('createGroupSuccess',this.onCreateGroupSuccess);
  },

  async getAllActivity() {
    // 再次检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，不加载活动数据');
      this.setData({
        activityList: []
      });
      return;
    }
    
    wx.request({
      url: GET_ALL_ACTIVITY,
      method: 'GET',
      success: async (res) => {
        // 如果没有数据，直接返回
        if (!res.data || res.data.length === 0) {
          this.setData({ activityList: [] });
          return;
        }
        
        // 使用 Promise.all 等待所有异步请求完成
        const activityPromises = res.data.map(async (activity) => {
          // 并行获取用户信息、场地信息和参与人数
          const [consumerRes, yardRes, joinCountRes] = await Promise.all([
            this.getOneConsumerPromise(activity.initiator),
            this.getUuidYardPromise(activity.activityUuid),
            this.getJoinCountPromise(activity.participantListUuid)
          ]);

          console.log(activity)

          // 获取真实参与人数，数据库返回的不包含发布者，所以加1
          let realCount = 1; // 默认包含发布者
          if (joinCountRes && joinCountRes.data && typeof joinCountRes.data === 'number') {
            realCount = joinCountRes.data + 1; // 数据库人数 + 发布者
          } else if (joinCountRes && joinCountRes.data && joinCountRes.data.count !== undefined) {
            realCount = joinCountRes.data.count + 1;
          }

          // 合并数据
          return {
            ...yardRes.data.data,
            // 活动发起人的用户信息（来自 getOneConsumer）
            userInfo: consumerRes?.data?.data || {},

            formattedTime: this.formatTime(activity.time),
            currentCount: realCount,  // 使用真实参与人数
            // 计算参与人数
            value: activity.value,
            participantListUuid: activity.participantListUuid,
            publishTime: activity.time,
            // 判断是否是当前用户发布
            isSelf: activity.initiator === this.data.currentUserOpenId
          };
        });

        // 等待所有活动数据处理完成
        const processedActivities = await Promise.all(activityPromises);

        // 修改点1：排序改为从旧到新（最早的在上面）
        processedActivities.sort((a, b) =>
          new Date(a.publishTime) - new Date(b.publishTime)
        );

        this.setData({
          activityList: processedActivities
        }, () => {
          // 加载完成后滚动到底部
          this.scrollToBottom();
        });

        console.log("处理后的活动列表", processedActivities);
      },
      fail: (err) => {
        console.error("获取活动列表失败", err);
        wx.showToast({
          title: '获取活动失败',
          icon: 'none'
        });
      }
    });
  },

  // 将 getJoinCount 改为返回 Promise
  getJoinCountPromise(participantListUuid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_JOIN_COUNT,
        method: 'POST',
        data: {
          participant: participantListUuid
        },
        header: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        success: (res) => {
          console.log(`活动 ${participantListUuid} 参与人数:`, res.data);
          resolve(res);
        },
        fail: (err) => {
          console.error("获取参与人数失败", err);
          // 失败时返回默认值，不影响整体流程
          resolve({ data: 0 });
        }
      });
    });
  },

  // 修改原来的 getJoinCoount 方法（注意拼写错误修正）
  getJoinCount(participantListUuid, callback) {
    wx.request({
      url: GET_JOIN_COUNT,
      method: 'POST',
      data: {
        participant: participantListUuid
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        console.log(res.data);
        if (callback) {
          callback(res.data);
        }
      },
      fail: (err) => {
        console.error("获取参与人数失败", err);
        if (callback) {
          callback(0);
        }
      }
    });
  },

  // 将 getOneConsumer 改为返回 Promise
  getOneConsumerPromise(openid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_ONE_CONSUMER,
        method: 'POST',
        header: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        data: {
          openid: openid
        },
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          console.error("获取用户信息失败", err);
          reject(err);
        }
      });
    });
  },
  
  // 将 getUuidYard 改为返回 Promise
  getUuidYardPromise(uuid) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: GET_UUID_YARD,
        method: 'POST',
        header: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        data: {
          uuid: uuid
        },
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          console.error("获取场地信息失败", err);
          reject(err);
        }
      });
    });
  },
  
  // 处理活动列表，添加 isSelf 字段和格式化时间
  processActivityList(activities) {
    const processedActivities = activities.map(activity => {
      // 计算参与人数
      const currentCount = activity.participants ? activity.participants.length : 1;

      return {
        ...activity,
        currentCount: currentCount,
        formattedTime: this.formatTime(activity.publishTime),
        isSelf: activity.userInfo.openId === this.data.currentUserOpenId
      };
    });

    // 按发布时间排序（最新的在前）
    processedActivities.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));

    this.setData({
      activityList: processedActivities
    });
  },


  // 把添加到最前面改为添加到最后面
  handleNewActivity(msg) {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，忽略新活动消息');
      return;
    }
    
    console.log('收到新活动:', msg);

    if (msg.type === 'new_activity' && msg.activity) {
      console.log('新活动数据:', msg.activity);

      // 计算当前参与人数
      const currentCount = msg.activity.participants ? msg.activity.participants.length : 1;

      // 格式化新活动数据
      const newActivity = {
        ...msg.activity,
        participant: msg.participant,
        participantListUuid: msg.participant,
        currentCount: currentCount,
        isSelf: msg.activity.userInfo?.openId === this.data.currentUserOpenId,
        // 使用 time 字段（与后端返回字段保持一致）
        formattedTime: this.formatTime(msg.activity.time || msg.activity.publishTime)
      };

      console.log('格式化数据:', newActivity);
      
      // 显示提示（只在非活动页面或需要提示时显示）
      // const pages = getCurrentPages();
      // const currentPage = pages[pages.length - 1];
      // const isActivityPage = currentPage && currentPage.route === 'pages/activity/activity';

      // if (!isActivityPage) {
      //   wx.showToast({
      //     title: '有新活动发布',
      //     icon: 'none',
      //     duration: 2000
      //   });
      // }

      // 添加到列表最后面
      const newActivityList = [...this.data.activityList, newActivity];

      this.setData({
        activityList: newActivityList
      }, () => {
        // 添加完成后滚动到底部
        this.scrollToBottom();
      });
    }
  },
  
  handleActivityCancelled(msg) {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，忽略活动取消消息');
      return;
    }
    
    console.log("收到活动取消消息:", msg);

    if (msg.type === 'activity_cancelled' && msg.participantListUuid) {
      const cancelUuid = msg.participantListUuid;
      console.log("要取消的活动UUID:", cancelUuid);

      // 获取当前活动列表
      const { activityList } = this.data;

      // 查找是否有匹配的活动
      const foundActivity = activityList.find(
        activity => activity.participantListUuid === cancelUuid
      );

      if (foundActivity) {
        console.log("找到匹配的活动，准备删除:", foundActivity);

        // 过滤掉要删除的活动
        const updatedActivityList = activityList.filter(
          activity => activity.participantListUuid !== cancelUuid
        );

        // 更新数据
        this.setData({
          activityList: updatedActivityList
        });

        // 显示提示
        wx.showToast({
          title: '活动已取消',
          icon: 'none',
          duration: 1500
        });

        console.log(`活动删除成功，剩余活动数: ${updatedActivityList.length}`);
      } else {
        console.log("未找到匹配的活动，UUID:", cancelUuid);
        console.log("当前列表中的UUID:", activityList.map(a => a.participantListUuid));
      }
    } else {
      console.error("活动取消消息格式错误:", msg);
    }
  },
  
  handleJoinActivity(msg) {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，忽略活动加入消息');
      return;
    }
    
    console.log("页面实例ID:", this.__wxExparserNodeId__ || Math.random());
    console.log("收到活动加入消息:", msg);

    if (msg.type === 'activity_joined' && msg.participantListUuid) {
      const joinUuid = msg.participantListUuid;
      const joinedTime = msg.joinedTime;

      // 生成唯一标识（使用UUID + 时间戳）
      const uniqueKey = `${joinUuid}_${joinedTime}`;

      // 检查是否已经处理过这条消息
      if (this.lastProcessedJoin && this.lastProcessedJoin === uniqueKey) {
        console.log("重复消息，已忽略处理");
        return;
      }

      // 记录已处理的消息
      this.lastProcessedJoin = uniqueKey;

      // 3秒后清除记录，避免影响后续相同活动的其他加入
      setTimeout(() => {
        if (this.lastProcessedJoin === uniqueKey) {
          this.lastProcessedJoin = null;
        }
      }, 3000);

      console.log("有用户加入的活动UUID:", joinUuid);

      // 获取当前活动列表
      const { activityList } = this.data;

      // 查找匹配的活动索引
      const activityIndex = activityList.findIndex(
        activity => activity.participantListUuid === joinUuid
      );

      if (activityIndex !== -1) {
        console.log("找到匹配的活动，准备更新参与人数:", activityList[activityIndex]);

        // 更新该活动的参与人数
        const updatedActivityList = [...activityList];
        const targetActivity = updatedActivityList[activityIndex];

        // currentCount + 1
        targetActivity.currentCount = (targetActivity.currentCount || 1) + 1;

        // 更新数据
        this.setData({
          activityList: updatedActivityList
        });

        console.log(`活动参与人数更新成功，当前人数: ${targetActivity.currentCount}`);
      } else {
        console.log("未找到匹配的活动，UUID:", joinUuid);
      }
    }
  },
  
  handleExitActivity(msg) {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，忽略活动退出消息');
      return;
    }
    
    console.log("收到活动退出消息:", msg);

    if (msg.type === 'activity_exit' && msg.participantListUuid) {
      const exitUuid = msg.participantListUuid;
      const exitTime = msg.exitTime;

      // 生成唯一标识（使用UUID + 时间戳）
      const uniqueKey = `${exitUuid}_${exitTime}`;

      // 检查是否已经处理过这条消息
      if (this.lastProcessedExit && this.lastProcessedExit === uniqueKey) {
        console.log("重复消息，已忽略处理");
        return;
      }

      // 记录已处理的消息
      this.lastProcessedExit = uniqueKey;

      // 3秒后清除记录，避免影响后续相同活动的其他退出
      setTimeout(() => {
        if (this.lastProcessedExit === uniqueKey) {
          this.lastProcessedExit = null;
        }
      }, 3000);

      console.log("有用户退出的活动UUID:", exitUuid);

      // 获取当前活动列表
      const { activityList } = this.data;

      // 查找匹配的活动索引
      const activityIndex = activityList.findIndex(
        activity => activity.participantListUuid === exitUuid
      );

      if (activityIndex !== -1) {
        console.log("找到匹配的活动，准备更新参与人数:", activityList[activityIndex]);

        // 更新该活动的参与人数
        const updatedActivityList = [...activityList];
        const targetActivity = updatedActivityList[activityIndex];

        // currentCount - 1，但不能少于1（因为至少包含发布者）
        targetActivity.currentCount = Math.max(1, (targetActivity.currentCount || 1) - 1);

        // 更新数据
        this.setData({
          activityList: updatedActivityList
        });

        console.log(`活动参与人数更新成功，当前人数: ${targetActivity.currentCount}`);
      } else {
        console.log("未找到匹配的活动，UUID:", exitUuid);
      }
    }
  },
  
  onCreateGroupSuccess(msg) {
    // 检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，忽略群聊创建成功消息');
      return;
    }
    
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
      const participantListUuid = messageData.participantListUuid;
      
      // 通过 participantListUuid 从活动列表中删除对应的活动
      if (participantListUuid) {
        console.log("要删除的活动UUID:", participantListUuid);
        
        // 获取当前活动列表
        const { activityList } = this.data;
        
        // 查找是否有匹配的活动
        const foundActivity = activityList.find(
          activity => activity.participantListUuid === participantListUuid
        );
        
        if (foundActivity) {
          console.log("找到匹配的活动，准备删除:", foundActivity);
          
          // 过滤掉要删除的活动
          const updatedActivityList = activityList.filter(
            activity => activity.participantListUuid !== participantListUuid
          );
          
          // 更新数据
          this.setData({
            activityList: updatedActivityList
          });
          
          // 可选：显示提示
          wx.showToast({
            title: '群聊创建成功，活动已移除',
            icon: 'none',
            duration: 1500
          });
          
          console.log(`活动删除成功，剩余活动数: ${updatedActivityList.length}`);
        } else {
          console.log("未找到匹配的活动，UUID:", participantListUuid);
          console.log("当前列表中的UUID:", activityList.map(a => a.participantListUuid));
        }
      }
    }
  },


  onActivityItemTap(e) {
    // 检查登录状态
    if (!this.checkLogin()) {
      this.showLoginTip();
      return;
    }
    
    // 获取传递的活动数据和索引
    const { activity, index } = e.currentTarget.dataset;
    console.log(activity);

    // 跳转到详情页，并将 activity 作为参数传递
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?activity=${JSON.stringify(activity)}`,
    });
  },
  
  // 新增：滚动到底部的方法
  scrollToBottom() {
    if (this.data.activityList.length === 0) return;
    const lastIndex = this.data.activityList.length - 1;
    this.setData({
      scrollIntoView: `activity-${lastIndex}`
    });
  },

  // 格式化时间的方法
  formatTime(time) {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;

    // 如果是今天
    if (date.toDateString() === now.toDateString()) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 如果是昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 其他情况显示完整日期
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
});