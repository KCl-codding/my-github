const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const API_CONFIG = require('../../config/api-config.js');
const EDIT_CONSUMER_NICKNAME = API_CONFIG.BASE_URL + API_CONFIG.USER.edit_consumer_nickname;
const EDIT_CONSUMER_GENDER = API_CONFIG.BASE_URL + API_CONFIG.USER.edit_consumer_gender;
const EDIT_CONSUMER_REGION = API_CONFIG.BASE_URL + API_CONFIG.USER.edit_consumer_region;

Page({
  behaviors: [loginTipBehavior],

  data: {
    type: '',

    // 昵称
    nicknameInput: '',

    // 性别
    genderOptions: ['男', '女'],
    genderIndex: -1,
    genderValue: 0,

    // 地区 - 使用对象格式更清晰
    regionData: {
      country: '',
      province: '',
      city: ''
    },
    regionText: '请选择地区',
    
    // 微信 picker 需要的地区索引
    regionIndex: [0, 0, 0]
  },

  onLoad(options) {
    const type = options.type;
    const value = options.value ? decodeURIComponent(options.value) : '';
    const country = options.country ? decodeURIComponent(options.country) : '';
    const province = options.province ? decodeURIComponent(options.province) : '';
    const city = options.city ? decodeURIComponent(options.city) : '';

    if (type === '性别') {
      let genderIndex = -1;
      let genderValue = 0;
      if (value == 1) {
        genderIndex = 0;
        genderValue = 1;
      } else if (value == 2) {
        genderIndex = 1;
        genderValue = 2;
      }
      this.setData({ genderIndex, genderValue });
    }
    else if (type === '地区') {
      // 显示 国家 省份 城市
      const regionText = [country, province, city].filter(item => item).join(' ');
      if (regionText) {
        this.setData({
          regionData: {
            country: country,
            province: province,
            city: city
          },
          regionText: regionText
        });
      }
    }
    else {
      this.setData({ nicknameInput: value });
    }

    this.setData({ type });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({ nicknameInput: e.detail.value });
  },

  onGenderChange(e) {
    const index = e.detail.value;
    console.log('onGenderChange 原始 index:', index, typeof index);
    
    // index 可能是字符串 "0" 或 "1"
    const genderValue = index == 0 ? 1 : 2;  // 使用宽松相等 ==
    console.log('计算出的 genderValue:', genderValue);
    
    this.setData({
      genderIndex: parseInt(index),  // 确保是数字
      genderValue: genderValue
    });
  },

  // 地区选择（微信 picker 返回的是 [省, 市, 区]）
  onRegionChange(e) {
    const { value, code } = e.detail;  // value: [省, 市, 区], code: [省code, 市code, 区code]
    const [province, city, district] = value;
    
    // 构建显示文本（去掉区，除非区和市不同）
    let regionText = `${province} ${city}`;
    if (district && district !== city && district !== '市辖区') {
      regionText += ` ${district}`;
    }
    
    // 国家固定为"中国"（根据实际业务调整）
    const country = '中国';
    
    this.setData({
      regionData: {
        country: country,
        province: province,
        city: city
      },
      regionText: regionText
    });
  },

  // 保存方法 - 调用实际接口
  saveData() {
    const type = this.data.type;
    const openid = this.getOpenId();

    switch (type) {
      case '昵称':
        if (!this.data.nicknameInput.trim()) {
          wx.showToast({ title: '请输入昵称', icon: 'none' });
          return;
        }
        this.editNickname(openid, this.data.nicknameInput);
        break;

      case '性别':
        if (this.data.genderIndex === -1) {
          wx.showToast({ title: '请选择性别', icon: 'none' });
          return;
        }
        this.editGender(openid, this.data.genderValue);
        break;

      case '地区':
        if (this.data.regionText === '请选择地区') {
          wx.showToast({ title: '请选择地区', icon: 'none' });
          return;
        }
        this.editRegion(openid, {
          country: this.data.regionData.country,
          province: this.data.regionData.province,
          city: this.data.regionData.city
        });
        break;
    }
  },

  // 获取 openid
  getOpenId() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      return userInfo?.openId || '';
    } catch (e) {
      console.error('获取openid失败', e);
      return '';
    }
  },

  // 修改昵称
  editNickname(openid, nickname) {
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    wx.request({
      url: EDIT_CONSUMER_NICKNAME,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        openid: openid,
        nickname: nickname
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          console.log('昵称修改成功:', res.data.data);
          this.updateLocalUserInfo('nickName', nickname);
          wx.showToast({ 
            title: '保存成功', 
            icon: 'success',
            success: () => setTimeout(() => wx.navigateBack(), 1500)
          });
        } else {
          wx.showToast({ title: res.data.message || '保存失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('昵称修改失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  // 修改性别
  editGender(openid, gender) {
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    wx.request({
      url: EDIT_CONSUMER_GENDER,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        openid: openid,
        gender: gender
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          console.log('性别修改成功:', res.data.data);
          this.updateLocalUserInfo('gender', gender);
          wx.showToast({ 
            title: '保存成功', 
            icon: 'success',
            success: () => setTimeout(() => wx.navigateBack(), 1500)
          });
        } else {
          wx.showToast({ title: res.data.message || '保存失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('性别修改失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  // 修改地区（国家、省份、城市）
  editRegion(openid, region) {
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    console.log('保存地区信息:', region);

    wx.showLoading({ title: '保存中...' });
    
    wx.request({
      url: EDIT_CONSUMER_REGION,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        openid: openid,
        province: region.province,
        city: region.city
        // 注意：如果接口需要国家参数，也加上 country: region.country
      },
      success: (res) => {
        wx.hideLoading();
        if (res.data.code === 200) {
          console.log('地区修改成功:', res.data.data);
          this.updateLocalUserInfo('region', region);
          wx.showToast({ 
            title: '保存成功', 
            icon: 'success',
            success: () => setTimeout(() => wx.navigateBack(), 1500)
          });
        } else {
          wx.showToast({ title: res.data.message || '保存失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('地区修改失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  // 更新本地用户信息
  updateLocalUserInfo(field, value) {
    try {
      let userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        userInfo = {};
      }
      
      if (field === 'region') {
        userInfo.country = value.country;
        userInfo.province = value.province;
        userInfo.city = value.city;
      } else if (field === 'nickName') {
        userInfo.nickName = value;
      } else if (field === 'gender') {
        userInfo.gender = value;
      } else {
        userInfo[field] = value;
      }
      
      wx.setStorageSync('userInfo', userInfo);
      
      // 触发上一页刷新
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        // 如果有 onShow 方法，调用它
        if (prevPage.onShow) {
          prevPage.onShow();
        }
        // 或者直接调用刷新数据的方法
        if (prevPage.loadUserInfo) {
          prevPage.loadUserInfo();
        }
      }
      
      console.log('本地用户信息更新成功', userInfo);
    } catch (e) {
      console.error('更新本地信息失败', e);
    }
  },

  goBack() {
    wx.navigateBack();
  }
});