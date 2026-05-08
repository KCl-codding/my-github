// pages/random-consumer/random-consumer.js
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_RANDOM_CONSUMER = API_CONFIG.BASE_URL + API_CONFIG.USER.get_random_consumer;
const GET_FOUR_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.get_four_yard

Page({
  behaviors: [loginTipBehavior],

  data: {
    random_consumer: [],
    isLogin: false,

    activityList: []
  },

  onLoad() {
    console.log(this.getUserInfo())
    const isLogin = this.checkLogin();
    if (!isLogin) {
      this.setData({ isLogin: false });
      // 不自动弹出登录提示，等用户点击换一批时再弹出
    } else {
      this.setData({ isLogin: true });
      this.getRandomConsumer();
      this.getFourYard();
    }
  },

  onShow() {
    const isLogin = this.checkLogin();
    if (isLogin && !this.data.isLogin) {
      this.setData({ isLogin: true });
      this.getRandomConsumer();
    } else if (!isLogin && this.data.isLogin) {
      this.setData({ isLogin: false, random_consumer: [] });
    }
  },

  getRandomConsumer() {
    this.showLoading();
    wx.request({
      url: GET_RANDOM_CONSUMER,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        openid: this.getUserInfo().openId
      },
      success: (res) => {
        this.hideLoading();
        const consumers = res.data.data || [];
        const processedConsumers = consumers.map(item => {
          item.genderFlag = (item.gender === '1') ? 'male' : 'female';
          return item;
        });
        this.setData({
          random_consumer: processedConsumers
        });
        console.log('用户数据:', this.data.random_consumer);
      },
      fail: (err) => {
        this.hideLoading();
        console.error('获取用户失败:', err);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  // 换一批按钮点击事件
  onRefreshTap() {
    console.log('点击换一批按钮');
    // 未登录时弹出登录组件
    if (!this.checkLogin()) {
      this.showLoginTip();
      return;
    }
    // 已登录时刷新数据
    this.getRandomConsumer();
  },
  // 点击头像跳转，携带 openid
  onAvatarTap(e) {
    if (!this.checkLogin()) {
      this.showLoginTip();
      return;
    }
    const openid = e.currentTarget.dataset.openid;
    console.log('点击的 openid:', openid);

    wx.navigateTo({
      url: `/pages/chat/chat?openid=${openid}`,
    });
  },
  // 头像加载错误处理
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const fallbackUrl = '../../resources/404.png';
    this.setData({
      [`random_consumer[${index}].avatarUrl`]: fallbackUrl
    });
  },

  getFourYard() {
    wx.request({
      url: GET_FOUR_YARD,
      method: 'GET',
      success: (res) => {
        this.setData({
          activityList: res.data.data
        });
        console.log(res.data.data)
      }
    })
  },
  // 重写登录成功回调
  onLoginSuccess() {
    this.setData({ isLogin: true });
    this.getRandomConsumer();
    this.getFourYard();
  },

  onActivityTap(e) {
    const item = e.currentTarget.dataset.item;
    console.log('点击活动:', item);

    // 未登录时弹出登录提示
    if (!this.checkLogin()) {
      this.showLoginTip();
      return;
    }

    wx.navigateTo({
      url: '/pages/activity-ui/activity-ui',
      success: (res) => {
        res.eventChannel.emit('sendData', {
          activity_message: e.currentTarget.dataset.item
        });
      }
    })

  },

  // 活动封面图加载错误处理
  onActivityCoverError(e) {
    const index = e.currentTarget.dataset.index;
    const defaultCover = '../../resources/404.png'; // 替换为默认图片地址
    this.setData({
      [`activityList[${index}].urls[0].url`]: defaultCover
    });
  },
});