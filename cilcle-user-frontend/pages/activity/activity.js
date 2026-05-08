// pages/activity/activity.js
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const GET_FOUR_TYPE_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.get_four_type_yard;

Page({
  behaviors: [loginTipBehavior],

  data: {
    type_list: ['饮食', '夜场', '音乐', '桌游', '密室', '盘本', '运动'],
    currentType: '饮食',
    activityList: [],
    leftList: [],
    rightList: [],
    loading: false,
  },

  onLoad() {
    this.checkAndLoadData();
  },

  onShow() {
    // 每次显示页面时，检查登录状态并重新加载数据
    this.checkAndLoadData();
  },

  // 检查登录状态并加载数据
  checkAndLoadData() {
    if (!this.checkLogin()) {
      console.log('未登录，清空活动数据');
      this.setData({
        activityList: [],
        leftList: [],
        rightList: [],
      });
      // 不显示登录提示，避免频繁弹窗
      return;
    }
    
    console.log('已登录，加载活动数据');
    this.loadData();
  },

  // 切换类型
  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.currentType) return;

    this.setData({
      currentType: type,
      activityList: [],
      leftList: [],
      rightList: [],
    });
    this.loadData();
  },

  // 加载数据
  loadData(openid) {
    // 加载前再次检查登录状态
    if (!this.checkLogin()) {
      console.log('未登录，不加载数据');
      return;
    }
    
    this.setData({ loading: true });

    wx.request({
      url: GET_FOUR_TYPE_YARD,
      method: 'POST',
      data: {
        type: this.data.currentType
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        console.log("获取到的活动列表", res.data.data);
        const list = res.data.data || [];

        // 分配到左右两列
        this.distributeToColumns(list);

        this.setData({
          activityList: list,
          loading: false
        });
      },
      fail: (err) => {
        console.error("请求失败", err);
        this.setData({ loading: false });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    });
  },

  // 将数据分配到左右两列（简单轮询分配）
  distributeToColumns(list) {
    const leftList = [];
    const rightList = [];

    list.forEach((item, index) => {
      if (index % 2 === 0) {
        leftList.push(item);
      } else {
        rightList.push(item);
      }
    });

    this.setData({ leftList, rightList });
  },

  // 查看详情
  goto(e) {
    // 跳转前检查登录状态
    if (!this.checkLogin()) {
      this.showLoginTip();
      return;
    }
    
    console.log('查看详情', e.currentTarget.dataset.yard);
    wx.navigateTo({
      url: '/pages/activity-ui/activity-ui',
      success: (res) => {
        res.eventChannel.emit('sendData', {
          activity_message: e.currentTarget.dataset.yard
        });
      }
    })
  },

  // 关闭loading
  onLoadingClose() {
    this.setData({ loadingVisible: false });
  }
});