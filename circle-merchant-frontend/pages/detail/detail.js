/*————————————————————引入登录模块————————————————————*/
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js')
const API_GET_UUID_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.get_uuid_yard
const API_SAVE_PAYS = API_CONFIG.BASE_URL + API_CONFIG.YARD.save_pays
const API_DELETE_PAYS= API_CONFIG.BASE_URL+API_CONFIG.YARD.delete_pays

Page({
  behaviors: [loginTipBehavior],

  data: {
    uuid: null,
    yard: {},
    loadingVisible: false,
    showAddModal: false,      // 控制添加弹窗显示
    newPayProject: '',        // 新项目名称
    newPayMoney: ''           // 新项目金额
  },

  onLoad(options) {
    this.setData({
      uuid: options.uuid
    });
    this.showLoading();
    this.getYard(options.uuid);
  },

  getYard(uuid) {
    // 检查 uuid 是否有效
    if (!uuid) {
      console.error('uuid 为空，无法获取数据');
      this.setData({ loadingVisible: false });
      return;
    }

    wx.request({
      url: API_GET_UUID_YARD,
      method: "POST",
      data: {
        uuid: uuid
      },
      header: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      success: (res) => {
        console.log('获取数据成功:', res.data.data);
        this.setData({
          yard: res.data.data,
          loadingVisible: false
        });
      },
      fail: (err) => {
        console.error('请求失败:', err);
        this.setData({ loadingVisible: false });
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      }
    })
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showAddModal: true,
      newPayProject: '',
      newPayMoney: ''
    });
  },

  // 关闭添加弹窗
  closeAddModal() {
    this.setData({ showAddModal: false });
  },

  // 阻止弹窗关闭（点击内容区域时）
  preventClose() {
    // 空函数，阻止事件冒泡
  },

  // 项目名称输入
  onProjectInput(e) {
    this.setData({ newPayProject: e.detail.value });
  },

  // 金额输入
  onMoneyInput(e) {
    this.setData({ newPayMoney: e.detail.value });
  },

  // 保存消费项目
  savePayItem() {
    const { newPayProject, newPayMoney, yard, uuid } = this.data;

    // 验证输入
    if (!newPayProject.trim()) {
      wx.showToast({ title: '请输入项目名称', icon: 'none' });
      return;
    }
    if (!newPayMoney || isNaN(parseFloat(newPayMoney)) || parseFloat(newPayMoney) <= 0) {
      wx.showToast({ title: '请输入有效的金额', icon: 'none' });
      return;
    }

    // 生成新项目ID（使用时间戳 + 随机数确保唯一性）
    const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const newPayItem = {
      id: newId,
      payProject: newPayProject.trim(),
      money: parseFloat(newPayMoney).toFixed(2)
    };

    // 先关闭弹窗，清空输入
    this.setData({
      showAddModal: false,
      newPayProject: '',
      newPayMoney: ''
    });

    // 显示加载中
    this.setData({ loadingVisible: true });

    // 上传消费项目
    this.uploadPayItem(newPayItem);
  },

  uploadPayItem(payItem) {
    const { yard, uuid } = this.data;

    // 构建要上传的数据
    const uploadData = {
      uuid: yard.uuid || yard.id || uuid, // 确保 uuid 存在
      payProject: payItem.payProject,
      money: parseFloat(payItem.money)
    };

    wx.request({
      url: API_SAVE_PAYS,
      method: 'POST',
      data: uploadData,
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('上传成功', res);
        // 上传成功后重新获取数据
        this.getYard(this.data.uuid);
        // 数据刷新后显示成功提示（在 getYard 的成功回调中显示）
      },
      fail: (err) => {
        console.error('上传失败', err);
        this.setData({ loadingVisible: false });
        wx.showToast({ title: '添加失败，请重试', icon: 'none' });
      }
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    })
  },

  onLoadingClose() {
    this.setData({ loadingVisible: false });
  },

  showLoading() {
    this.setData({ loadingVisible: true });
  },

  hideLoading() {
    this.setData({ loadingVisible: false });
  },

  getDetailData(uuid) {
    // 预留方法
  },
  // 长按删除消费项目
  onLongPressPayItem(e) {
    console.log(e.currentTarget)
    // 获取点击的项目数据
    const pays_uuid = e.currentTarget.dataset.pays_uuid;

    // 输出 uuid
    console.log('长按删除 - uuid:', pays_uuid);

    // 显示删除确认弹窗
    wx.showModal({
      title: '删除确认',
      content: `确定要删除吗？`,
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 这里调用删除接口
          this.deletePayItem(pays_uuid);
        }
      }
    });
  },

  // 删除消费项目
  deletePayItem(paysUuid) {
 
    this.showLoading();

    wx.request({
      url: API_DELETE_PAYS,
      method: 'POST',
      data: {
        paysUuid: paysUuid,
      },
      header: {
        'Content-Type': 'application/x-www-form-urlencoded'  // 表单格式
      },
      success: (res) => {
        this.getYard(this.data.uuid);
      },
      fail: (err) => {
        this.setData({ loadingVisible: false });
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    });
  }
})
