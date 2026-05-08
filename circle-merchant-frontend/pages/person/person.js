const { uploadImageToCOS } = require('../../utils/cosUploader.js');
const API_CONFIG = require('../../config/api-config.js');
const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const UPLOAD_MERCHANT_URL = API_CONFIG.BASE_URL + API_CONFIG.USER.upload_merchant_url;

Page({
  behaviors: [loginTipBehavior],

  data: {
    userInfo: {},
    genderText: '未设置',
    regionText: '未选择',
    uploading: false,
    progress: 0,
    isLogin: false,
    // 弹窗相关配置
    popupTitle: '',
    popupDesc: '',
    popupCancelText: '',
    popupConfirmText: '',
    popupAction: '' // 用于标识当前弹窗的动作：'login' 或 'logout'
  },

  onLoad() {
    this.checkAndLoadUserInfo();
    
    // 监听全局登录成功事件
    const app = getApp();
    app.onEvent('loginSuccess', this.onLoginSuccess.bind(this));
  },

  onUnload() {
    // 页面卸载时移除事件监听
    const app = getApp();
    app.offEvent('loginSuccess', this.onLoginSuccess);
  },

  onShow() {
    // 每次页面显示时，重新检查登录状态并加载数据
    this.checkAndLoadUserInfo();
  },

  // 登录成功回调
  onLoginSuccess() {
    console.log('个人中心：检测到登录成功，刷新页面数据');
    // 延迟一下确保登录数据已写入
    setTimeout(() => {
      this.checkAndLoadUserInfo();
    }, 300);
  },

  // 检查登录状态并加载用户信息
  checkAndLoadUserInfo() {
    const isLogin = this.checkLogin();
    
    if (!isLogin) {
      // 未登录状态
      this.setData({ 
        isLogin: false,
        userInfo: {},
        genderText: '未设置',
        regionText: '未选择'
      });
      return;
    }
    
    // 已登录状态，加载用户信息
    this.setData({ isLogin: true });
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = this.getUserInfo();
    console.log('获取到的用户数据:', userInfo);

    if (userInfo && userInfo.openId) {
      let genderText = '未设置';
      if (userInfo.gender == 1) genderText = '男';
      if (userInfo.gender == 2) genderText = '女';

      let regionText = '未选择';
      if (userInfo.province && userInfo.city) {
        regionText = `${userInfo.province} ${userInfo.city}`;
      } else if (userInfo.province) {
        regionText = userInfo.province;
      } else if (userInfo.city) {
        regionText = userInfo.city;
      }

      this.setData({
        userInfo: userInfo,
        genderText,
        regionText
      });
    } else {
      this.setData({
        userInfo: {},
        genderText: '未设置',
        regionText: '未选择'
      });
    }
  },

  // ==================== 未登录状态处理 ====================
  
  // 未登录状态下点击"立即登录"按钮
  onUnloginTap() {
    // 显示登录提示弹窗
    this.setData({
      popupTitle: '登录提示',
      popupDesc: '登录后即可享用全部内容',
      popupCancelText: '暂不登录',
      popupConfirmText: '立即登录',
      popupAction: 'login'
    });
    this.setData({ showLoginTip: true });
  },

  // ==================== 已登录状态处理 ====================

  // 退出登录按钮点击
  onLogout() {
    // 显示退出确认弹窗
    this.setData({
      popupTitle: '确认退出',
      popupDesc: '退出后需要重新登录',
      popupCancelText: '暂不退出',
      popupConfirmText: '立即退出',
      popupAction: 'logout'
    });
    this.setData({ showLoginTip: true });
  },

  // ==================== 弹窗统一回调处理 ====================

  // 弹窗确认回调（根据 action 区分处理）
  onPopupConfirm() {
    const action = this.data.popupAction;
    
    if (action === 'login') {
      // 登录确认：调用 Behavior 中的登录方法
      this.onGoLogin();
    } else if (action === 'logout') {
      // 退出确认：执行退出逻辑
      this.doLogout();
    }
    
    // 关闭弹窗
    this.setData({ showLoginTip: false });
  },

  // 执行退出登录
  doLogout() {
    // 调用 Behavior 中的 logout 方法
    this.showLoading();
    this.logout();
    // 清空页面数据
    this.setData({
      isLogin: false,
      userInfo: {},
      genderText: '未设置',
      regionText: '未选择'
    });
    this.hideLoading();
  },

  // ==================== 其他功能 ====================

  uploadAvatar() {
    // 再次确认登录状态
    if (!this.checkLogin()) {
      this.onUnloginTap();
      return;
    }
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        this.setData({
          uploading: true,
          progress: 0
        });

        uploadImageToCOS({
          filePath: tempFilePath,
          uploadType: 'images',
          onProgress: (progress) => {
            this.setData({ progress: progress });
          },
          onSuccess: (imageUrl) => {
            this.setData({
              'userInfo.avatarUrl': imageUrl,
              uploading: false,
              progress: 100
            });

            this.uploadUrl(this.getUserInfo().openId, imageUrl);
            wx.showToast({ title: '头像更新成功', icon: 'success' });
          },
          onFail: (error) => {
            this.setData({ uploading: false, progress: 0 });
            wx.showToast({ title: error.message || '上传失败', icon: 'none' });
          }
        });
      }
    });
  },

  uploadUrl(openid, url) {
    wx.request({
      url: UPLOAD_MERCHANT_URL,
      data: {
        openid: openid,
        url: url
      },
      method: 'POST',
      success: (res) => {
        this.updateLocalAvatarUrl(url);
        console.log(res.data.data)
      }
    })
  },

  updateLocalAvatarUrl(newAvatarUrl) {
    try {
      const app = getApp();
      const userInfo = wx.getStorageSync(app.getStorageKey('userInfo'));  // 加前缀
      if (userInfo) {
        userInfo.avatarUrl = newAvatarUrl;
        wx.setStorageSync(app.getStorageKey('userInfo'), userInfo);  // 加前缀
        console.log('本地用户头像已更新:', newAvatarUrl);
      }
    } catch (e) {
      console.error('更新本地用户信息失败', e);
    }
  },
  editNickname() {
    if (!this.checkLogin()) {
      this.onUnloginTap();
      return;
    }
    this.navigateToEdit('昵称', this.data.userInfo.nickName);
  },

  selectGender() {
    if (!this.checkLogin()) {
      this.onUnloginTap();
      return;
    }
    this.navigateToEdit('性别', this.data.userInfo.gender);
  },

  chooseRegion() {
    if (!this.checkLogin()) {
      this.onUnloginTap();
      return;
    }
    const userInfo = this.data.userInfo;
    wx.navigateTo({
      url: `/pages/edit/edit?type=地区&country=${encodeURIComponent(userInfo.country || '')}&province=${encodeURIComponent(userInfo.province || '')}&city=${encodeURIComponent(userInfo.city || '')}`
    });
  },

  navigateToEdit(type, value) {
    const encodedValue = encodeURIComponent(value || '');
    wx.navigateTo({
      url: `/pages/edit/edit?type=${type}&value=${encodedValue}`
    });
  }
});