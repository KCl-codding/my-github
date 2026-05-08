/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_ONE_MERCHANT = API_CONFIG.BASE_URL + API_CONFIG.USER.get_one_merchant
const GET_ALL_CONSUMER_OPENID = API_CONFIG.BASE_URL + API_CONFIG.USER.get_all_consumer_openid

Page({
  behaviors: [loginTipBehavior],

  /**
   * 页面的初始数据
   */
  data: {
    activity_message: {},
    one_merchant_message: {},
    all_consunmer_openid: [],

    currentPeopleCount: 0,    // 当前修改的人数
    maxPeopleCount: 0,         // 最大人数限制
    originalPeopleCount: 0     // 原始人数（用于验证）
  },

  onLoad(options) {
    const eventChannel = this.getOpenerEventChannel();

    // 监听发送的数据
    eventChannel.on('sendData', (data) => {
      console.log('收到活动数据:', data);
      const originalCount = parseInt(data.activity_message.value) || 0;

      this.setData({
        activity_message: data.activity_message,
        currentPeopleCount: originalCount,
        maxPeopleCount: originalCount,
        originalPeopleCount: originalCount
      });
      this.get_one_merchant(data.activity_message.openid)
    });

    this.getConsumerList();
  },

  get_one_merchant(openid) {
    wx.request({
      url: GET_ONE_MERCHANT,
      method: 'POST',
      data: {
        openid: openid
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        this.setData({
          one_merchant_message: res.data.data
        });
      }
    })
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    })
  },

  previewImage(e) {
    const currentUrl = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    const imageUrls = urls.map(item => item.url);
    wx.previewImage({
      current: currentUrl,
      urls: imageUrls
    });
  },

  onContactMerchant() {
    wx.navigateTo({
      url: '/pages/chat-ui/chat-ui',
      success: (res) => {
        res.eventChannel.emit('sendData', {
          one_consumer: this.data.one_merchant_message
        });
      }
    })
  },

  // 减少人数
  decreasePeople() {
    let newCount = this.data.currentPeopleCount - 1;
    if (newCount < 2) {
      wx.showToast({
        title: '人数不能少于2人',
        icon: 'none'
      });
      return;
    }
    this.setData({
      currentPeopleCount: newCount
    });
  },

  // 增加人数
  increasePeople() {
    let newCount = this.data.currentPeopleCount + 1;
    if (newCount > this.data.maxPeopleCount) {
      wx.showToast({
        title: `人数不能超过${this.data.maxPeopleCount}人`,
        icon: 'none'
      });
      return;
    }
    this.setData({
      currentPeopleCount: newCount
    });
  },

  // 输入人数
  onPeopleInput(e) {
    let value = parseInt(e.detail.value);
    if (isNaN(value)) {
      value = 2;
    }

    // 限制范围
    if (value < 2) {
      value = 2;
    } else if (value > this.data.maxPeopleCount) {
      value = this.data.maxPeopleCount;
    }

    this.setData({
      currentPeopleCount: value
    });
  },

  // 验证人数（失去焦点时）
  validatePeopleCount() {
    let currentCount = this.data.currentPeopleCount;

    if (currentCount < 1) {
      this.setData({
        currentPeopleCount: 1
      });
      wx.showToast({
        title: '人数已调整为1人',
        icon: 'none'
      });
    } else if (currentCount > this.data.maxPeopleCount) {
      this.setData({
        currentPeopleCount: this.data.maxPeopleCount
      });
      wx.showToast({
        title: `人数不能超过${this.data.maxPeopleCount}人`,
        icon: 'none'
      });
    }
  },

  getConsumerList() {
    wx.request({
      url: GET_ALL_CONSUMER_OPENID,
      method: 'GET',
      success: (res) => {
        this.setData({
          all_consunmer_openid: res.data.data
        });
      }
    })
  },
  // 发布到广场
  goto() {
    // 更新activity_message中的人数
    const updatedActivity = {
      ...this.data.activity_message,
      value: this.data.currentPeopleCount
    };

    console.log('发布的活动数据:', updatedActivity);

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

    console.log(this.data.all_consunmer_openid)
    const sendData = {
      type: "publish_activity",
      activity: {
        ...updatedActivity,
        openidList: this.data.all_consunmer_openid,
        userInfo:this.getUserInfo()
      }
    };

    wx.sendSocketMessage({
      data: JSON.stringify(sendData),
      success: () => {
        console.log('活动发布请求已发送');

        // 延迟后关闭 loading 并返回
        setTimeout(() => {
          wx.hideLoading();
          setTimeout(() => {
            wx.navigateBack({
              delta: 1,
            });
          }, 1500);
        }, 500);
      },
    });

  },

})