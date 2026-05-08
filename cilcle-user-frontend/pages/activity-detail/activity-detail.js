/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_ALL_CONSUMER_OPENID = API_CONFIG.BASE_URL + API_CONFIG.USER.get_all_consumer_openid
const GET_JOIN_OPENID = API_CONFIG.MESSAGE_URL + API_CONFIG.ACTIVITY.get_join_openid;
const GET_JOIN_URL = API_CONFIG.BASE_URL + API_CONFIG.USER.get_join_url

Page({
  behaviors: [loginTipBehavior],

  data: {
    myself_openid: null,
    activity: null,
    all_consunmer_openid: [],
    joinOpenidList: [], // 参与者openid列表（唯一）
    joinUrlList: [],

    isSelf: false,
    buttonText: '加载中...',

    totalMoney: 0,

    isLoading: true, // 加载状态
    canTap: true, // 按钮是否可以点击（节流用）
  },

  onLoad(options) {
    this.getConsumerList();
    // 获取当前用户 openid
    const myself_openid = this.getUserInfo().openId;
    console.log('当前用户openid:', myself_openid);

    // 获取活动数据
    let activity = null;
    if (options.activity) {
      activity = JSON.parse(decodeURIComponent(options.activity));
    }

    console.log('活动发布者openid:', activity.userInfo.openid);
    console.log('活动数据完整信息:', activity);

    // 计算总金额
    let totalMoney = 0;
    if (activity.pays && activity.pays.length > 0) {
      totalMoney = activity.pays.reduce((sum, item) => sum + item.money, 0);
    }

    this.setData({
      myself_openid,
      activity,
      totalMoney,
    });

    // 获取参与者列表，成功后会自动初始化按钮状态
    this.getJoinOpenidList(activity.participantListUuid);

    const app = getApp();

    this.handleJoinActivity = this.handleJoinActivity.bind(this);
    this.handleExitActivity = this.handleExitActivity.bind(this);
    this.handleActivityCancelled = this.handleActivityCancelled.bind(this);

    app.onEvent('activityJoined', this.handleJoinActivity);
    app.onEvent('activityExit', this.handleExitActivity);
    app.onEvent('activityCancelled', this.handleActivityCancelled);
  },

  onUnload() {
    // 页面卸载时移除监听
    const app = getApp();
    app.offEvent('activityJoined', this.handleJoinActivity);
    app.offEvent('activityExit', this.handleExitActivity);
    app.offEvent('activityCancelled', this.handleActivityCancelled);
  },

  handleActivityCancelled(msg) {
    if (msg.type === 'activity_cancelled' && msg.participantListUuid) {
      this.goBack();
    }
  },
  handleJoinActivity(msg) {
    console.log("收到活动加入消息:", msg);

    // 检查是否是当前活动的加入消息
    if (msg.type === 'activity_joined' && msg.participantListUuid === this.data.activity.participantListUuid) {
      const joinOpenid = msg.joinOpenid;

      // 防止重复添加
      if (this.data.joinOpenidList.includes(joinOpenid)) {
        console.log('用户已存在，跳过添加');
        return;
      }

      const newJoinOpenidList = [...this.data.joinOpenidList, joinOpenid];

      this.setData({
        joinOpenidList: newJoinOpenidList,
        'activity.currentCount': this.data.activity.currentCount + 1,
      });

      this.getJoinUrlList(newJoinOpenidList);
      // 重新判断按钮状态
      this.initButtonStatus();
    }
  },
  handleExitActivity(msg) {
    console.log("收到活动退出消息:", msg);

    // 检查是否是当前活动的退出消息
    if (msg.type === 'activity_exit' && msg.participantListUuid === this.data.activity.participantListUuid) {
      const exitOpenid = msg.from;  // 使用 from 字段，因为消息中用的是 from 而不是 joinOpenid

      console.log('退出者openid:', exitOpenid);
      console.log('当前用户openid:', this.data.myself_openid);
      console.log('当前参与者列表:', this.data.joinOpenidList);

      // 从列表中移除退出的用户
      const newJoinOpenidList = this.data.joinOpenidList.filter(
        openid => openid !== exitOpenid
      );

      console.log('更新后的参与者列表:', newJoinOpenidList);

      // 更新数据
      this.setData({
        joinOpenidList: newJoinOpenidList,
        'activity.currentCount': Math.max(0, this.data.activity.currentCount - 1)
      });

      // 更新头像列表（重要！）
      this.getJoinUrlList(newJoinOpenidList);

      // 重新判断当前用户的按钮状态
      this.initButtonStatus();
    }
  },

  /**
   * 初始化按钮状态
   */
  initButtonStatus() {
    const { myself_openid, activity, joinOpenidList, isLoading } = this.data;

    // 如果还在加载中，不更新按钮
    if (isLoading) {
      console.log('数据加载中，暂不更新按钮状态');
      return;
    }

    // 判断是否是自己的活动 - openid 在 userInfo 里面
    if (myself_openid === activity.userInfo.openid || myself_openid === activity.userInfo.openId) {
      // 自己的活动 - 显示"取消活动"
      this.setData({
        isSelf: true,
        buttonText: '取消活动'
      });
      console.log('是自己的活动，显示：取消活动');
      return; // 直接返回，不再执行后续判断
    }

    // 判断是否已参加
    const hasJoined = joinOpenidList.includes(myself_openid);
    if (hasJoined) {
      this.setData({
        isSelf: false,
        buttonText: '取消参加'
      });
      console.log('已参加该活动');
      return;
    }

    // 别人的活动且未参加 - 显示"参与活动"
    this.setData({
      isSelf: false,
      buttonText: '参与活动'
    });
    console.log('是别人的活动，显示：参与活动');
  },

  /**
   * 按钮点击事件（带节流）
   */

  onButtonTap() {
    const { isSelf, buttonText, isLoading, canTap } = this.data;
    console.log('按钮点击:', buttonText);

    // 节流控制：2秒内不能重复点击
    if (!canTap) {
      console.log('操作太频繁，请稍后再试');
      return;
    }

    // 如果还在加载中，阻止点击
    if (isLoading) {
      wx.showToast({
        title: '数据加载中，请稍后',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    // 设置节流锁
    this.setData({ canTap: false });
    setTimeout(() => {
      this.setData({ canTap: true });
      this.hideLoading();
    }, 1500); // 改为2000毫秒（2秒）

    // 如果按钮显示"取消参加"
    if (buttonText === '取消参加') {
      this.exitActivity();
      return;
    }

    if (isSelf) {
      this.cancelActivity();
    } else {
      if (this.data.activity.currentCount == this.data.activity.value) {
        return
      }
      this.joinActivity();
    }
  },
  /**
   * 取消活动（撤回活动）
   */
  cancelActivity() {
    const activity = this.data.activity;

    // 获取 app 实例
    const app = getApp();

    // 检查 WebSocket 是否已连接
    if (!app.globalData.socketOpen) {
      wx.showToast({
        title: '网络连接中，请稍后再试',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确定要取消这个活动吗？取消后所有用户将无法看到该活动',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '取消中...',
            mask: true
          });

          const sendData = {
            type: "cancel_activity",
            openidList: this.data.all_consunmer_openid,
            participantListUuid: activity.participantListUuid,
          };

          wx.sendSocketMessage({
            data: JSON.stringify(sendData),
            success: () => {
              console.log('活动取消请求已发送');

              // 延迟后关闭 loading 并返回
              setTimeout(() => {
                wx.hideLoading();
                wx.showToast({
                  title: '取消成功',
                  icon: 'success',
                  duration: 1500
                });

                setTimeout(() => {
                  wx.navigateBack({
                    delta: 1,
                  });
                }, 1500);
              }, 500);
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '取消失败',
                icon: 'none'
              });
              console.error('发送失败:', err);
            }
          });
        }
      }
    });
  },
  /**
   * 参与活动
   */
  joinActivity() {
    this.showLoading();

    const activity = this.data.activity;

    // 获取 app 实例
    const app = getApp();
    // 检查 WebSocket 是否已连接
    if (!app.globalData.socketOpen) {
      return;
    }

    const sendData = {
      type: "join_activity",
      openidList: this.data.all_consunmer_openid,
      participantListUuid: activity.participantListUuid,
    };

    wx.sendSocketMessage({
      data: JSON.stringify(sendData),
      success: () => {
        console.log('参与活动请求已发送');
      },
    });
  },

  /**
   * 退出活动
   */
  exitActivity() {
    this.showLoading()
    const activity = this.data.activity;

    // 获取 app 实例
    const app = getApp();

    // 检查 WebSocket 是否已连接
    if (!app.globalData.socketOpen) {
      return;
    }

    const sendData = {
      type: "exit_activity",
      openidList: this.data.all_consunmer_openid,
      participantListUuid: activity.participantListUuid,
    };

    wx.sendSocketMessage({
      data: JSON.stringify(sendData),
    });
  },

  getConsumerList() {
    wx.request({
      url: GET_ALL_CONSUMER_OPENID,
      method: 'GET',
      success: (res) => {
        this.setData({
          all_consunmer_openid: res.data.data
        });
      },
      fail: (err) => {
        console.error('获取消费者列表失败:', err);
      }
    })
  },

  getJoinOpenidList(participant) {
    this.setData({ isLoading: true });

    wx.request({
      url: GET_JOIN_OPENID,
      method: 'POST',
      data: {
        participant: participant
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        this.setData({
          joinOpenidList: res.data,
          isLoading: false
        });
        console.log('参与者列表:', res.data);
        this.getJoinUrlList(res.data);
        // 数据获取成功后，初始化按钮状态
        this.initButtonStatus();
      },
      fail: (err) => {
        console.error('获取参与者列表失败:', err);
        this.setData({ isLoading: false });
        // 即使失败也要初始化按钮状态，避免一直显示"加载中..."
        this.initButtonStatus();
      }
    })
  },
  getJoinUrlList(openidList) {
    wx.request({
      url: GET_JOIN_URL,
      method: 'POST',
      data: openidList,
      success: (res) => {
        this.setData({
          joinUrlList: res.data.data,

        });
        console.log('头像地址:', res.data.data);
      },
    })
  },


  /**
   * 预览图片
   */
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    });
  }
});