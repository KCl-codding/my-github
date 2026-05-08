const loginTipBehavior = require('../../behavior/login-popup-behavior.js');
const COSUploader = require('../../utils/cosUploader.js');
const API_CONFIG = require('../../config/api-config.js');
const SAVE_YARD = API_CONFIG.BASE_URL + API_CONFIG.YARD.save;

Page({
  behaviors: [loginTipBehavior],
  data: {
    typeOptions: ['饮食', '夜场', '音乐', '桌游', '密室', '盘本', '运动'],
    typeIndex: -1,
    activity: '',
    position: '',
    value: '',
    pays: [],
    imageList: [], // 存储图片信息 { tempUrl, localPath, uploaded, error, serverUrl }
    isUploading: false, // 是否正在上传中
    loadingVisible: false,
    showLoginTip: false,
    uploadType: 'activity'
  },

  // 选择图片（只预览，不上传）
  async chooseImage() {
    const maxCount = 9 - this.data.imageList.length;
    if (maxCount <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      });
      return;
    }

    try {
      const res = await wx.chooseImage({
        count: maxCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const tempFiles = res.tempFiles;
      const newImages = tempFiles.map(file => ({
        tempUrl: file.path,      // 本地临时路径，用于预览
        localPath: file.path,    // 保存本地路径，用于上传
        uploaded: false,         // 是否已上传到服务器
        error: false,            // 是否上传失败
        serverUrl: ''            // 服务器返回的URL
      }));

      // 添加到列表（只预览，不上传）
      const updatedImageList = [...this.data.imageList, ...newImages];
      this.setData({ imageList: updatedImageList });

      wx.showToast({
        title: `已添加${newImages.length}张图片`,
        icon: 'success',
        duration: 1500
      });

    } catch (err) {
      console.error('选择图片失败', err);
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },

  // 批量上传所有图片
  async uploadAllImages() {
    const imageList = this.data.imageList;

    // 过滤出未上传的图片
    const pendingImages = imageList.filter(img => !img.uploaded && !img.error);

    if (pendingImages.length === 0) {
      return true; // 没有需要上传的图片
    }

    this.setData({ isUploading: true });

    // 显示上传进度
    wx.showLoading({
      title: `上传图片 0/${pendingImages.length}`,
      mask: true
    });

    let successCount = 0;
    let failCount = 0;

    // 顺序上传（避免并发过多）
    for (let i = 0; i < imageList.length; i++) {
      const img = imageList[i];

      // 跳过已上传或失败的图片
      if (img.uploaded) continue;
      if (img.error) continue;

      try {
        const serverUrl = await this.uploadSingleImage(img.localPath);

        // 更新图片状态
        imageList[i] = {
          ...img,
          uploaded: true,
          error: false,
          serverUrl: serverUrl
        };
        this.setData({ imageList });

        successCount++;
        wx.showLoading({
          title: `上传图片 ${successCount + failCount}/${pendingImages.length}`,
          mask: true
        });

      } catch (error) {
        console.error('上传失败:', error);
        imageList[i] = {
          ...img,
          uploaded: false,
          error: true,
          serverUrl: ''
        };
        this.setData({ imageList });
        failCount++;
      }
    }

    wx.hideLoading();
    this.setData({ isUploading: false });

    // 显示上传结果
    if (failCount > 0) {
      wx.showToast({
        title: `上传完成：成功${successCount}张，失败${failCount}张`,
        icon: 'none',
        duration: 2000
      });
      return false;
    } else if (successCount > 0) {
      wx.showToast({
        title: `成功上传${successCount}张图片`,
        icon: 'success',
        duration: 1500
      });
      return true;
    }

    return true;
  },

  // 上传单张图片到腾讯云COS
  uploadSingleImage(localPath) {
    return new Promise((resolve, reject) => {
      COSUploader.uploadImageToCOS({
        filePath: localPath,
        uploadType: this.data.uploadType,
        onProgress: (percent) => {
          // 可选：更新单张图片进度（如果需要可以添加progress字段）
        },
        onSuccess: (imageUrl) => {
          resolve(imageUrl);
        },
        onFail: (error) => {
          reject(error);
        }
      });
    });
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const current = this.data.imageList[index].tempUrl;
    const urls = this.data.imageList.map(img => img.tempUrl);

    wx.previewImage({
      current: current,
      urls: urls
    });
  },

  // 删除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = [...this.data.imageList];
    imageList.splice(index, 1);
    this.setData({ imageList });
  },

  // 重传失败的图片
  async retryUpload(e) {
    const index = e.currentTarget.dataset.index;
    const img = this.data.imageList[index];

    if (img.error && !img.uploaded && !this.data.isUploading) {
      // 重置状态
      const imageList = [...this.data.imageList];
      imageList[index] = {
        ...img,
        error: false,
        uploaded: false
      };
      this.setData({ imageList });

      wx.showToast({
        title: '重新上传中...',
        icon: 'loading',
        duration: 1000
      });

      try {
        const serverUrl = await this.uploadSingleImage(img.localPath);
        imageList[index] = {
          ...img,
          uploaded: true,
          error: false,
          serverUrl: serverUrl
        };
        this.setData({ imageList });

        wx.showToast({
          title: '重传成功',
          icon: 'success'
        });
      } catch (err) {
        imageList[index] = {
          ...img,
          uploaded: false,
          error: true
        };
        this.setData({ imageList });

        wx.showToast({
          title: '重传失败',
          icon: 'none'
        });
      }
    }
  },

  // 表单提交
  async formSubmit(e) {
    // 检查是否正在上传
    if (this.data.isUploading) {
      wx.showToast({
        title: '图片正在上传中，请稍后...',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 验证必填项
    if (this.data.typeIndex === -1) {
      wx.showToast({
        title: '请选择活动类型',
        icon: 'none'
      });
      return;
    }

    if (!this.data.activity.trim()) {
      wx.showToast({
        title: '请输入活动描述',
        icon: 'none'
      });
      return;
    }

    if (!this.data.position.trim()) {
      wx.showToast({
        title: '请输入详细位置',
        icon: 'none'
      });
      return;
    }

    // 先上传所有图片
    const uploadSuccess = await this.uploadAllImages();

    // 检查是否有上传失败的图片
    const hasError = this.data.imageList.some(img => img.error === true);
    if (hasError) {
      const confirm = await new Promise((resolve) => {
        wx.showModal({
          title: '提示',
          content: '部分图片上传失败，是否继续提交？',
          confirmText: '继续提交',
          cancelText: '重新上传',
          success: (res) => {
            resolve(res.confirm);
          }
        });
      });

      if (!confirm) {
        return;
      }
    }

    // 构建提交数据（只包含已成功上传的图片）
    const formData = {
      openid: this.getUserInfo().openId,
      type: this.data.typeOptions[this.data.typeIndex] || '',
      uuid: '',
      activity: this.data.activity.trim(),
      position: this.data.position.trim(),
      value: parseFloat(this.data.value) || 0,
      pays: this.data.pays
        .filter(item => item.payProject && item.payProject.trim() && item.money)
        .map(item => ({
          payProject: item.payProject.trim(),
          money: parseFloat(item.money) || 0
        })),
      urls: this.data.imageList
        .filter(img => img.uploaded && img.serverUrl)
        .map(img => ({ url: img.serverUrl })),
      createTime: new Date().getTime()
    };

    console.log('提交的数据：', JSON.stringify(formData, null, 2));

    // 显示加载提示
    this.setData({ loadingVisible: true });

    try {
      // 这里调用你的实际提交接口
      const result = await this.submitFormData(formData);

      this.setData({ loadingVisible: false });

      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      });

    } catch (error) {
      this.setData({ loadingVisible: false });
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
      console.error('提交失败', error);
    }
  },

  submitFormData(fromData) {
    wx.request({
      url: SAVE_YARD,
      method: 'POST',
      data: fromData,
      success:(res)=>{
        console.log(res.data.data)
      }
    })
  },

  // 其他表单处理方法
  onTypeChange(e) {
    this.setData({ typeIndex: e.detail.value });
  },

  onActivityInput(e) {
    this.setData({ activity: e.detail.value });
  },

  onPositionInput(e) {
    this.setData({ position: e.detail.value });
  },

  onValueInput(e) {
    this.setData({ value: e.detail.value });
  },

  onPayInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const newPays = [...this.data.pays];
    newPays[index][field] = e.detail.value;
    this.setData({ pays: newPays });
  },

  addPay() {
    const newPays = [...this.data.pays, { payProject: '', money: '' }];
    this.setData({ pays: newPays });
  },

  removePay(e) {
    const index = e.currentTarget.dataset.index;
    const newPays = [...this.data.pays];
    newPays.splice(index, 1);
    this.setData({ pays: newPays });
  },

  goBack() {
    wx.navigateBack();
  },

  onLoadingClose() {
    this.setData({ loadingVisible: false });
  }
});